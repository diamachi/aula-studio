use tauri::{Theme, WebviewWindow};

#[tauri::command]
pub fn set_app_theme(window: WebviewWindow, theme: String) -> Result<(), String> {
    let dark = match theme.as_str() {
        "dark" => true,
        "light" => false,
        _ => return Err("Unknown app theme".into()),
    };
    window.set_theme(Some(if dark { Theme::Dark } else { Theme::Light })).map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    window.set_background_color(Some(if dark {
        tauri::window::Color(0x17, 0x1c, 0x19, 0xff)
    } else {
        tauri::window::Color(0xf4, 0xf2, 0xed, 0xff)
    })).map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    {
        let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as isize;
        let (caption, text) = if dark { (color(0x20, 0x20, 0x29), color(0xee, 0xe8, 0xf5)) }
            else { (color(0xf3, 0xe9, 0xdb), color(0x46, 0x37, 0x2d)) };
        window.run_on_main_thread(move || {
            // Windows 11 supports caption/text colors. Earlier versions retain
            // Tauri's native light/dark title bar if these optional calls fail.
            // SAFETY: a live Tauri HWND and pointers to two local COLORREFs;
            // DWM reads exactly four bytes synchronously during each call.
            unsafe {
                let _ = DwmSetWindowAttribute(hwnd, 35, &caption as *const u32 as *const _, 4);
                let _ = DwmSetWindowAttribute(hwnd, 36, &text as *const u32 as *const _, 4);
            }
        }).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn color(r: u8, g: u8, b: u8) -> u32 { r as u32 | ((g as u32) << 8) | ((b as u32) << 16) }

#[cfg(target_os = "windows")]
#[link(name = "dwmapi")]
extern "system" {
    fn DwmSetWindowAttribute(hwnd: isize, attribute: u32, value: *const std::ffi::c_void, size: u32) -> i32;
}
