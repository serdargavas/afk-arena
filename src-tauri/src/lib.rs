use std::fs;
use tauri::{Manager, PhysicalPosition, WebviewWindow};

const SAVE_FILE: &str = "save.json";

/// Read the save file from the app data dir. Returns None if it doesn't exist.
#[tauri::command]
fn load_game(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = dir.join(SAVE_FILE);
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(&path).map(Some).map_err(|e| e.to_string())
}

/// Write the save atomically (temp file + rename) to avoid partial/corrupt saves.
#[tauri::command]
fn save_game(app: tauri::AppHandle, data: String) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let tmp = dir.join("save.json.tmp");
    fs::write(&tmp, data).map_err(|e| e.to_string())?;
    fs::rename(&tmp, dir.join(SAVE_FILE)).map_err(|e| e.to_string())?;
    Ok(())
}

/// Snap the (frameless) window to the bottom-right corner of its monitor.
fn position_bottom_right(win: &WebviewWindow) {
    let monitor = match win.current_monitor() {
        Ok(Some(m)) => Some(m),
        _ => win.primary_monitor().ok().flatten(),
    };
    let Some(monitor) = monitor else { return };
    let screen = monitor.size();
    let Ok(size) = win.outer_size() else { return };
    let margin = 24_i32;
    let dock_gap = 72_i32; // leave room above the Dock
    let x = screen.width as i32 - size.width as i32 - margin;
    let y = screen.height as i32 - size.height as i32 - margin - dock_gap;
    let _ = win.set_position(PhysicalPosition::new(x.max(0), y.max(0)));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![load_game, save_game])
        .setup(|app| {
            if let Some(win) = app.get_webview_window("main") {
                position_bottom_right(&win);
                let _ = win.show(); // config starts hidden to avoid a corner "jump"
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
