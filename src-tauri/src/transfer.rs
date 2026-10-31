use hidapi::HidDevice;
use std::time::Duration;

trait ReportIo {
    fn write_report(&self, data: &[u8]) -> Result<usize, String>;
    fn read_report(&self, data: &mut [u8], timeout: i32) -> Result<usize, String>;
}
impl ReportIo for HidDevice {
    fn write_report(&self, data: &[u8]) -> Result<usize, String> { self.write(data).map_err(|e| e.to_string()) }
    fn read_report(&self, data: &mut [u8], timeout: i32) -> Result<usize, String> { self.read_timeout(data, timeout).map_err(|e| e.to_string()) }
}

fn matches_ack(reply: &[u8], sent: &[u8; 33]) -> bool {
    let body = if reply.first() == Some(&0) { &reply[1..] } else { reply };
    body.len() >= 3 && body[..3] == sent[1..4]
}

fn exchange(io: &impl ReportIo, packet: &[u8; 33]) -> Result<(), String> {
    if io.write_report(packet)? != packet.len() { return Err("Short USB write".into()); }
    let mut buffer = [0u8; 512];
    let mut last = String::from("none");
    // The vendor sender polls the echo before advancing to the next chunk.
    for _ in 0..24 {
        let n = io.read_report(&mut buffer, 15)?;
        if n != 0 {
            if matches_ack(&buffer[..n], packet) { return Ok(()); }
            last = buffer[..n.min(8)].iter().map(|b| format!("{b:02X}")).collect::<Vec<_>>().join(" ");
        }
    }
    Err(format!("No receiver acknowledgment for {:02X}/{:02X}/{:02X} (last reply: {last})", packet[1], packet[2], packet[3]))
}

fn transfer(io: &impl ReportIo, packets: &[[u8; 33]], pause: impl Fn()) -> Result<(), String> {
    // The vendor initializes the receiver before configuration traffic. Ordinary
    // effects may work without this, but the custom upload needs the session.
    let mut init = [0u8; 33];
    init[1] = 2;
    init[32] = 2;
    exchange(io, &init).map_err(|e| format!("Receiver initialization failed: {e}"))?;
    for (index, packet) in packets.iter().enumerate() {
        exchange(io, packet).map_err(|e| format!("Configuration stopped at packet {}/{}: {e}", index+1, packets.len()))?;
        pause();
    }
    Ok(())
}

pub fn send_configuration(device: &HidDevice, packets: &[[u8; 33]]) -> Result<(), String> {
    // Discard queued battery/status input before checking the new transaction.
    let mut buffer = [0u8; 512];
    for _ in 0..32 { if device.read_timeout(&mut buffer, 1).map_err(|e| e.to_string())? == 0 { break; } }
    transfer(device, packets, || std::thread::sleep(Duration::from_millis(2)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    struct Fake { writes: RefCell<Vec<Vec<u8>>>, replies: RefCell<std::collections::VecDeque<Vec<u8>>> }
    impl ReportIo for Fake {
        fn write_report(&self, p: &[u8]) -> Result<usize,String> { self.writes.borrow_mut().push(p.to_vec()); Ok(p.len()) }
        fn read_report(&self, b: &mut [u8], _: i32) -> Result<usize,String> { let r=self.replies.borrow_mut().pop_front().unwrap_or_default(); b[..r.len()].copy_from_slice(&r); Ok(r.len()) }
    }
    fn packet(seq:u8)->[u8;33] { let mut p=[0;33];p[1..4].copy_from_slice(&[0x14,28,seq]);p }
    #[test]
    fn matches_exact_chunk_with_either_report_id_format() {
        assert!(matches_ack(&[0x14,28,3], &packet(3)));
        assert!(matches_ack(&[0,0x14,28,3], &packet(3)));
        assert!(!matches_ack(&[0x14,28,2], &packet(3)));
        assert!(!matches_ack(&[0x20,1,0,85], &packet(3)));
        assert!(!matches_ack(&[0], &packet(3)));
    }
    #[test]
    fn stops_after_first_unacknowledged_chunk() {
        let fake=Fake{writes:RefCell::new(vec![]),replies:RefCell::new(vec![vec![2,0,0],vec![0x20,1,0,84]].into())};
        let error=transfer(&fake,&[packet(0),packet(1)],||{}).unwrap_err();
        assert!(error.contains("packet 1/2")); assert_eq!(fake.writes.borrow().len(),2);
    }
    #[test]
    fn ignores_status_and_waits_for_each_chunk() {
        let fake=Fake{writes:RefCell::new(vec![]),replies:RefCell::new(vec![vec![2,0,0],vec![0x20,1,0,84],vec![0x14,28,0],vec![0,0x14,28,1]].into())};
        transfer(&fake,&[packet(0),packet(1)],||{}).unwrap();
        assert_eq!(fake.writes.borrow().len(),3);
        assert_eq!(fake.writes.borrow()[0][1],2);
    }
    #[test]
    fn no_custom_mode_write_if_initialization_fails() {
        let fake=Fake{writes:RefCell::new(vec![]),replies:RefCell::new(vec![].into())};
        assert!(transfer(&fake,&[packet(0)],||{}).unwrap_err().contains("initialization failed"));
        assert_eq!(fake.writes.borrow().len(),1);
    }
}
