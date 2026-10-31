// Adapted from VitalyArt's MIT F75 Max driver; see research/LICENSE.upstream.
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct KeyColor { pub index: u8, pub color: String }

// Wireless custom mode and chunk format adapted from thibaultmiclo/aula-driver.
// See research/LICENSE.perkey and research/per-key-provenance.md.
pub fn per_key_packets(colors: &[KeyColor], brightness: u8) -> Result<Vec<[u8; 33]>, String> {
    if !(1..=5).contains(&brightness) { return Err("Brightness must be 1..5".into()); }
    let layout: Vec<serde_json::Value> = serde_json::from_str(include_str!("../../src/key-layout.json")).map_err(|e| e.to_string())?;
    let valid: Vec<u8> = layout.iter().filter_map(|k| k["index"].as_u64().map(|n| n as u8)).collect();
    if colors.len() != valid.len() { return Err("A complete F75 Max color layout is required".into()); }
    let mut seen = std::collections::HashSet::new();
    let mut table = [0u8; 576];
    for key in colors {
        if !valid.contains(&key.index) || !seen.insert(key.index) { return Err("Invalid or repeated LED index".into()); }
        if key.color.len() != 6 || !key.color.bytes().all(|b| b.is_ascii_hexdigit()) { return Err("Invalid key color".into()); }
        let rgb = u32::from_str_radix(&key.color, 16).map_err(|e| e.to_string())?;
        let offset = key.index as usize * 4;
        table[offset..offset+4].copy_from_slice(&[key.index, (rgb >> 16) as u8, (rgb >> 8) as u8, rgb as u8]);
    }
    table[574..].copy_from_slice(&[0xaa, 0x55]);
    fn packet(command: u8, index: u8, data: &[u8]) -> [u8; 33] {
        let mut p = [0u8; 33];
        p[1..4].copy_from_slice(&[command, data.len() as u8, index]);
        p[4..4+data.len()].copy_from_slice(data);
        p[32] = p[1..32].iter().fold(0u8, |a, b| a.wrapping_add(*b));
        p
    }
    let mut preamble = [0u8; 16];
    preamble[0] = 0x80; preamble[9] = brightness;
    preamble[14..].copy_from_slice(&[0xaa, 0x55]);
    let mut result = vec![packet(5, 0, &preamble)];
    for (i, chunk) in table.chunks(28).enumerate() { result.push(packet(0x14, i as u8, chunk)); }
    Ok(result)
}

pub fn rgb_packets(mode: u8, color: &str, brightness: u8, speed: u8, colorful: bool, direction: u8) -> Result<[[u8; 33]; 2], String> {
    if mode > 19 || !(1..=5).contains(&brightness) || !(1..=5).contains(&speed) || direction > 3 {
        return Err("Invalid lighting settings".into());
    }
    if color.len() != 6 || !color.bytes().all(|c| c.is_ascii_hexdigit()) {
        return Err("Use a six-digit hex color".into());
    }
    let rgb = u32::from_str_radix(color, 16).map_err(|e| e.to_string())?;
    let mut packets = [[0u8; 33]; 2];
    packets[0][1] = 0x0f;
    let p = &mut packets[1];
    p[1..5].copy_from_slice(&[5, 0x10, 0, mode]);
    if mode != 0 {
        p[5..8].copy_from_slice(&[(rgb >> 16) as u8, (rgb >> 8) as u8, rgb as u8]);
        p[12..16].copy_from_slice(&[colorful as u8, brightness, speed, direction]);
    }
    p[18..20].copy_from_slice(&[0xaa, 0x55]);
    for p in &mut packets { p[32] = p[1..32].iter().fold(0u8, |sum, b| sum.wrapping_add(*b)); }
    Ok(packets)
}

pub fn battery_packet() -> [u8; 33] {
    let mut p = [0u8; 33];
    p[1] = 0x20; p[2] = 1; p[32] = 0x21;
    p
}

pub fn parse_battery(data: &[u8]) -> Option<u8> {
    let body = if data.first() == Some(&0) { &data[1..] } else { data };
    if body.len() >= 4 && body[0..2] == [0x20, 1] && body[3] <= 100 { Some(body[3]) } else { None }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn full_colors() -> Vec<KeyColor> {
        let keys: Vec<serde_json::Value> = serde_json::from_str(include_str!("../../src/key-layout.json")).unwrap();
        keys.iter().map(|k| KeyColor { index: k["index"].as_u64().unwrap() as u8, color: "123456".into() }).collect()
    }
    #[test]
    fn per_key_layout_and_chunk_boundaries() {
        let colors = full_colors();
        let p = per_key_packets(&colors, 4).unwrap();
        assert_eq!(p.len(), 22);
        assert_eq!(&p[0][1..5], &[5,16,0,0x80]);
        assert_eq!(p[0][13], 4);
        assert_eq!(&p[0][18..20], &[0xaa,0x55]);
        let mut table = Vec::new();
        for (i, packet) in p[1..].iter().enumerate() {
            assert_eq!(packet[1], 0x14); assert_eq!(packet[3], i as u8);
            table.extend_from_slice(&packet[4..4+packet[2] as usize]);
        }
        assert_eq!(table.len(), 576);
        assert_eq!(p.last().unwrap()[2], 16);
        assert_eq!(&table[574..], &[0xaa,0x55]);
        for key in colors { let o=key.index as usize*4; assert_eq!(&table[o..o+4], &[key.index,0x12,0x34,0x56]); }
        for packet in p { assert_eq!(packet[32], packet[1..32].iter().fold(0u8, |a,b|a.wrapping_add(*b))); }
    }
    #[test]
    fn per_key_rejects_incomplete_or_invalid_maps() {
        let mut colors=full_colors(); colors.pop(); assert!(per_key_packets(&colors,3).is_err());
        let mut colors=full_colors(); colors[1].index=colors[0].index; assert!(per_key_packets(&colors,3).is_err());
        let mut colors=full_colors(); colors[0].color="ZZZZZZ".into(); assert!(per_key_packets(&colors,3).is_err());
        assert!(per_key_packets(&full_colors(),0).is_err());
    }
    #[test]
    fn matches_working_python_protocol() {
        let p = rgb_packets(1, "123456", 5, 2, false, 0).unwrap();
        assert_eq!(p[0][1], 15); assert_eq!(p[0][32], 15);
        assert_eq!(&p[1][..8], &[0, 5, 16, 0, 1, 0x12, 0x34, 0x56]);
        assert_eq!(&p[1][12..16], &[0, 5, 2, 0]);
        assert_eq!(&p[1][18..20], &[0xaa, 0x55]);
        for packet in p { assert_eq!(packet[32], packet[1..32].iter().fold(0u8, |a, b| a.wrapping_add(*b))); }
    }
    #[test]
    fn off_and_validation() {
        let p = rgb_packets(0, "FFFFFF", 5, 5, true, 3).unwrap();
        assert_eq!(&p[1][5..18], &[0; 13]);
        for (mode, color, b, s, d) in [(20, "ffffff", 3, 3, 0), (1, "💡xx", 3, 3, 0), (1, "000000", 0, 3, 0), (1, "000000", 3, 6, 0), (1, "000000", 3, 3, 4)] {
            assert!(rgb_packets(mode, color, b, s, false, d).is_err());
        }
    }
    #[test]
    fn battery_formats() {
        assert_eq!(battery_packet()[32], 0x21);
        assert_eq!(parse_battery(&[0x20, 1, 0, 87]), Some(87));
        assert_eq!(parse_battery(&[0, 0x20, 1, 0, 100]), Some(100));
        assert_eq!(parse_battery(&[0x20, 1, 0, 0]), Some(0));
        for data in [&[][..], &[0], &[0x20, 1], &[0x20, 2, 0, 50], &[0x20, 1, 0, 255]] { assert_eq!(parse_battery(data), None); }
    }
}
