#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod protocol;
mod transfer;
use hidapi::{DeviceInfo, HidApi, HidDevice};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{Duration, Instant};

static HID_LOCK: Mutex<()> = Mutex::new(());
fn eligible(d: &DeviceInfo) -> bool {
    let matches = d.vendor_id() == 0x05ac && d.product_id() == 0x024f && d.usage_page() == 0xff60;
    #[cfg(target_os = "windows")]
    { matches && d.interface_number() == 3 }
    #[cfg(not(target_os = "windows"))]
    { matches }
}
fn identity(d: &DeviceInfo) -> String { d.path().to_bytes().iter().map(|b| format!("{b:02x}")).collect() }
fn open(api: &HidApi, id: &str) -> Result<HidDevice, String> {
    let info = api.device_list().find(|d| eligible(d) && identity(d) == id)
        .ok_or("Receiver disconnected. Scan and select it again.")?;
    let device = info.open_device(api).map_err(|e| format!("Cannot open receiver: {e}"))?;
    let mut descriptor = [0u8; 4096];
    let length = device.get_report_descriptor(&mut descriptor).map_err(|e| format!("Cannot inspect receiver reports: {e}"))?;
    // This device's descriptor declares byte-sized, unnumbered output reports.
    // Interface 4 has the same VID/PID/page but uses 64-byte bodies instead.
    if !descriptor[..length].windows(4).any(|bytes| bytes == [0x95, 0x20, 0x91, 0x02]) {
        return Err("Select the 32-byte receiver interface (interface 3 on Windows). The selected endpoint uses a different report format.".into());
    }
    Ok(device)
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Receiver { id: String, name: String, interface: i32, usage: u16 }

#[tauri::command]
async fn scan_receivers() -> Result<Vec<Receiver>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let _guard = HID_LOCK.lock().map_err(|e| e.to_string())?;
        let api = HidApi::new().map_err(|e| e.to_string())?;
        let mut devices: Vec<_> = api.device_list().filter(|d| eligible(d)).map(|d| Receiver {
            id: identity(d), name: "F75 Max · 2.4 GHz".into(), interface: d.interface_number(), usage: d.usage(),
        }).collect();
        devices.sort_by_key(|d| d.interface);
        Ok(devices)
    }).await.map_err(|e| e.to_string())?
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Lighting { mode: u8, color: String, brightness: u8, speed: u8, colorful: bool, direction: u8 }

#[tauri::command]
async fn apply_lighting(id: String, settings: Lighting) -> Result<(), String> {
    let packets = protocol::rgb_packets(settings.mode, &settings.color, settings.brightness, settings.speed, settings.colorful, settings.direction)?;
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = HID_LOCK.lock().map_err(|e| e.to_string())?;
        let api = HidApi::new().map_err(|e| e.to_string())?;
        let device = open(&api, &id)?;
        for (index, packet) in packets.iter().enumerate() {
            let count = device.write(packet).map_err(|e| e.to_string())?;
            if count != packet.len() { return Err("Incomplete receiver write. Reconnect and retry.".into()); }
            if index == 0 { std::thread::sleep(Duration::from_millis(50)); }
        }
        Ok(())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn apply_per_key(id: String, colors: Vec<protocol::KeyColor>, brightness: u8, restore: Lighting) -> Result<(), String> {
    let packets = protocol::per_key_packets(&colors, brightness)?;
    let restore_packets = protocol::rgb_packets(restore.mode, &restore.color, restore.brightness, restore.speed, restore.colorful, restore.direction)?;
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = HID_LOCK.lock().map_err(|e| e.to_string())?;
        let api = HidApi::new().map_err(|e| e.to_string())?;
        let device = open(&api, &id)?;
        if let Err(error) = transfer::send_custom(&device, &packets) {
            let mut restored = true;
            for packet in restore_packets {
                restored &= matches!(device.write(&packet), Ok(33));
                std::thread::sleep(Duration::from_millis(50));
            }
            return Err(format!("{error}. {}", if restored { "Built-in effect restore reports were sent. Check the keyboard; try receiver interface 3 and close other driver windows." } else { "Restore failed. Reconnect and apply a built-in effect." }));
        }
        Ok(())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn read_battery(id: String) -> Result<Option<u8>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = HID_LOCK.lock().map_err(|e| e.to_string())?;
        let api = HidApi::new().map_err(|e| e.to_string())?;
        let device = open(&api, &id)?;
        let p = protocol::battery_packet();
        if device.write(&p).map_err(|e| e.to_string())? != p.len() { return Err("Incomplete battery query".into()); }
        let deadline = Instant::now() + Duration::from_millis(1500);
        let mut buffer = [0u8; 512];
        while Instant::now() < deadline {
            let n = device.read_timeout(&mut buffer, 100).map_err(|e| e.to_string())?;
            if let Some(percent) = protocol::parse_battery(&buffer[..n]) { return Ok(Some(percent)); }
        }
        Ok(None)
    }).await.map_err(|e| e.to_string())?
}
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![scan_receivers, apply_lighting, apply_per_key, read_battery])
        .run(tauri::generate_context!()).expect("Unable to launch AULA Studio");
}
