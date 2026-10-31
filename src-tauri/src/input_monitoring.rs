#[cfg(target_os = "macos")]
use std::sync::atomic::{AtomicBool, Ordering};

#[cfg(target_os = "macos")]
const LISTEN_EVENT: i32 = 1;
#[cfg(target_os = "macos")]
const ACCESS_GRANTED: i32 = 0;
#[cfg(target_os = "macos")]
const ACCESS_UNKNOWN: i32 = 2;
#[cfg(target_os = "macos")]
static ACCESS_REQUESTED: AtomicBool = AtomicBool::new(false);

#[cfg(target_os = "macos")]
#[link(name = "IOKit", kind = "framework")]
extern "C" {
    fn IOHIDCheckAccess(request_type: i32) -> i32;
    fn IOHIDRequestAccess(request_type: i32) -> bool;
}

#[cfg(target_os = "macos")]
pub fn request_if_needed() -> Result<(), String> {
    // IOHIDAccessType: Granted = 0, Denied = 1, Unknown = 2.
    let access = unsafe { IOHIDCheckAccess(LISTEN_EVENT) };
    if access == ACCESS_GRANTED {
        return Ok(());
    }

    // The system prompt is appropriate on first use. If access is already
    // denied, the app instead guides the user to the Input Monitoring pane.
    if access == ACCESS_UNKNOWN && !ACCESS_REQUESTED.swap(true, Ordering::Relaxed) {
        let _ = unsafe { IOHIDRequestAccess(LISTEN_EVENT) };
    }

    Err("AULA_INPUT_MONITORING_REQUIRED".into())
}

#[tauri::command]
pub fn open_input_monitoring_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("/usr/bin/open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent")
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("Cannot open Input Monitoring settings: {error}"))
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Input Monitoring settings are available on macOS only.".into())
    }
}
