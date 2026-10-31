#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod protocol;
mod transfer;
mod display;
mod appearance;
mod input_monitoring;
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

// HIDAPI reconstructs descriptors differently on some platforms, so match
// the report's meaning rather than depending on one exact byte sequence.
fn has_32_byte_output_report(descriptor: &[u8]) -> bool {
    let (mut report_size, mut report_count, mut report_id) = (0usize, 0usize, 0u8);
    let mut globals = Vec::new();
    let mut output_bits = [0usize; 256];
    let mut offset = 0;

    while offset < descriptor.len() {
        let prefix = descriptor[offset];
        offset += 1;
        if prefix == 0xfe {
            if offset + 2 > descriptor.len() { return false; }
            let length = descriptor[offset] as usize;
            offset += 2;
            if offset + length > descriptor.len() { return false; }
            offset += length;
            continue;
        }

        let data_len = match prefix & 0x03 { 0 => 0, 1 => 1, 2 => 2, _ => 4 };
        if offset + data_len > descriptor.len() { return false; }
        let item_type = (prefix >> 2) & 0x03;
        let item_tag = prefix >> 4;
        let mut value = 0usize;
        for (shift, byte) in descriptor[offset..offset + data_len].iter().enumerate() {
            value |= (*byte as usize) << (shift * 8);
        }
        offset += data_len;

        if item_type == 1 {
            match item_tag {
                7 => report_size = value,
                8 => report_id = value as u8,
                9 => report_count = value,
                10 => globals.push((report_size, report_count, report_id)),
                11 => if let Some((size, count, id)) = globals.pop() {
                    report_size = size;
                    report_count = count;
                    report_id = id;
                },
                _ => {}
            }
        } else if item_type == 0 && item_tag == 9 {
            output_bits[report_id as usize] = output_bits[report_id as usize]
                .saturating_add(report_size.saturating_mul(report_count));
        }
    }

    output_bits[0] == 32 * 8 && output_bits[1..].iter().all(|bits| *bits == 0)
}

fn has_compatible_output(device: &HidDevice) -> Result<bool, String> {
    let mut descriptor = [0u8; 4096];
    device.get_report_descriptor(&mut descriptor)
        .map(|length| has_32_byte_output_report(&descriptor[..length]))
        .map_err(|error| format!("Cannot inspect receiver reports: {error}"))
}

fn open(api: &HidApi, id: &str) -> Result<HidDevice, String> {
    let info = api.device_list().find(|d| eligible(d) && identity(d) == id)
        .ok_or("Receiver disconnected. Scan and select it again.")?;
    let device = info.open_device(api).map_err(|e| format!("Cannot open receiver: {e}"))?;
    if !has_compatible_output(&device)? {
        return Err("The selected endpoint does not expose the 32-byte receiver output report. Rescan and select the compatible receiver interface.".into());
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
        let mut devices = Vec::new();
        #[cfg(target_os = "macos")]
        let mut input_monitoring_required = false;
        for info in api.device_list().filter(|d| eligible(d)) {
            // Windows exposes the proven interface as interface 3. Other
            // platforms can number composite HID collections differently;
            // inspect the report itself and hide the incompatible 64-byte one.
            #[cfg(not(target_os = "windows"))]
            {
                let device = match info.open_device(&api) {
                    Ok(device) => device,
                    Err(_) => {
                        #[cfg(target_os = "macos")]
                        if input_monitoring::request_if_needed().is_err() {
                            input_monitoring_required = true;
                        }
                        continue;
                    }
                };
                if !matches!(has_compatible_output(&device), Ok(true)) { continue; }
            }
            devices.push(Receiver {
                id: identity(info), name: "F75 Max · 2.4 GHz".into(), interface: info.interface_number(), usage: info.usage(),
            });
        }
        #[cfg(target_os = "macos")]
        if devices.is_empty() && input_monitoring_required {
            return Err("AULA_INPUT_MONITORING_REQUIRED".into());
        }
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
        if let Err(error) = transfer::send_configuration(&device, &packets) {
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
async fn apply_sleep(id:String,settings:protocol::SleepSettings)->Result<(),String>{
    let packet=protocol::sleep_packet(&settings)?;
    tauri::async_runtime::spawn_blocking(move||{
        let _guard=HID_LOCK.lock().map_err(|e|e.to_string())?;
        let api=HidApi::new().map_err(|e|e.to_string())?;
        let device=open(&api,&id)?;
        transfer::send_configuration(&device,&[packet])
    }).await.map_err(|e|e.to_string())?
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
        .manage(display::DisplayState::default())
        .invoke_handler(tauri::generate_handler![scan_receivers, apply_lighting, apply_per_key, apply_sleep, read_battery, display::scan_display, display::prepare_display, display::upload_display, display::sync_display_clock, appearance::set_app_theme, input_monitoring::open_input_monitoring_settings])
        .run(tauri::generate_context!()).expect("Unable to launch AULA Studio");
}
