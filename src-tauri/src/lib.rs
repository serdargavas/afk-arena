use std::fs;
use std::io::{BufRead, BufReader, ErrorKind, Write};
use std::net::{TcpListener, TcpStream};
use std::thread;
use std::time::{Duration, Instant};

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use sha2::{Digest, Sha256};
use tauri::{Manager, PhysicalPosition, WebviewWindow};
use tauri_plugin_opener::OpenerExt;

const SAVE_FILE: &str = "save.json";

/// Whether the window should float over other apps' fullscreen spaces. Kept in
/// Rust because tao re-asserts its own (weaker) window level/behavior on every
/// hide/show cycle — e.g. returning from the tray — so we must re-apply ours.
static FLOAT_OVER_FULLSCREEN: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

const GOOGLE_CLIENT_ID: &str = env!("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET: &str = env!("GOOGLE_CLIENT_SECRET");
const AUTH_TIMEOUT_SECS: u64 = 180;

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

/// Set the native NSWindow collection behavior + level so the window floats even
/// over OTHER apps' fullscreen spaces (tao's always-on-top alone does not do this).
#[cfg(target_os = "macos")]
fn apply_float_level(window: &WebviewWindow, on: bool) {
    use objc::runtime::Object;
    use objc::{msg_send, sel, sel_impl};
    if let Ok(ptr) = window.ns_window() {
        let ns = ptr as *mut Object;
        unsafe {
            // CanJoinAllSpaces (1<<0) | Stationary (1<<4) | FullScreenAuxiliary (1<<8)
            // → the window exists on every space, including other apps' fullscreen
            // spaces, and doesn't get swept by Exposé; 0 restores defaults.
            let behavior: u64 = if on { (1 << 0) | (1 << 4) | (1 << 8) } else { 0 };
            let _: () = msg_send![ns, setCollectionBehavior: behavior];
            // NSPopUpMenuWindowLevel (101): reliably above fullscreen apps
            // (NSStatusWindowLevel 25 can end up beneath them); 0 = normal.
            let level: i64 = if on { 101 } else { 0 };
            let _: () = msg_send![ns, setLevel: level];
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn apply_float_level(_window: &WebviewWindow, _on: bool) {}

/// Keep the window above everything — including other apps' fullscreen windows.
#[tauri::command]
fn set_always_on_top(window: WebviewWindow, on: bool) -> Result<(), String> {
    window.set_always_on_top(on).map_err(|e| e.to_string())?;
    // Don't drop the fullscreen float if that setting is still on.
    let float = on || FLOAT_OVER_FULLSCREEN.load(std::sync::atomic::Ordering::Relaxed);
    apply_float_level(&window, float);
    Ok(())
}

/// Explicit "over fullscreen / all Spaces" toggle (same native treatment).
#[tauri::command]
fn set_over_fullscreen(window: WebviewWindow, on: bool) -> Result<(), String> {
    // Regular apps' NSWindows are excluded from OTHER apps' fullscreen spaces no
    // matter which flags they carry — only an NSPanel with the non-activating
    // style reliably rides above them. Convert once, on first enable.
    #[cfg(target_os = "macos")]
    if on {
        use cocoa::appkit::NSWindowCollectionBehavior;
        use tauri_nspanel::WebviewWindowExt as PanelWindowExt;
        let panel = window.to_panel().map_err(|e| e.to_string())?;
        panel.set_style_mask(1 << 7); // NSWindowStyleMaskNonactivatingPanel
        panel.set_level(101); // NSPopUpMenuWindowLevel
        panel.set_collection_behaviour(
            NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
                | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary
                | NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary,
        );
    }
    window
        .set_visible_on_all_workspaces(on)
        .map_err(|e| e.to_string())?;
    window.set_always_on_top(on).map_err(|e| e.to_string())?;
    // Last word wins: tao's calls above reset level/behavior, so ours goes last;
    // the flag is only remembered once the native state actually changed.
    apply_float_level(&window, on);
    FLOAT_OVER_FULLSCREEN.store(on, std::sync::atomic::Ordering::Relaxed);
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
    // Sizes are physical pixels; scale the logical margins so spacing is correct
    // on HiDPI/Retina displays (review finding #5).
    let scale = monitor.scale_factor();
    let margin = (24.0 * scale) as i32;
    let dock_gap = (72.0 * scale) as i32; // leave room above the Dock
    let x = screen.width as i32 - size.width as i32 - margin;
    let y = screen.height as i32 - size.height as i32 - margin - dock_gap;
    let _ = win.set_position(PhysicalPosition::new(x.max(0), y.max(0)));
}

// ---------- Google OAuth (desktop / installed-app PKCE flow) ----------

fn random_b64url(bytes: usize) -> String {
    let mut buf = vec![0u8; bytes];
    getrandom::getrandom(&mut buf).expect("OS RNG unavailable");
    URL_SAFE_NO_PAD.encode(&buf)
}

fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        match b[i] {
            b'%' if i + 2 < b.len() => {
                let hex = std::str::from_utf8(&b[i + 1..i + 3]).unwrap_or("");
                if let Ok(v) = u8::from_str_radix(hex, 16) {
                    out.push(v);
                    i += 3;
                    continue;
                }
                out.push(b'%');
                i += 1;
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            c => {
                out.push(c);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn query_param(query: &str, key: &str) -> Option<String> {
    query.split('&').find_map(|pair| {
        let (k, v) = pair.split_once('=')?;
        (k == key).then(|| percent_decode(v))
    })
}

/// Read one HTTP request off the loopback socket, reply with a friendly page, and
/// return the OAuth result: Some(Ok(code)) once the redirect lands, Some(Err(..))
/// on an error/state-mismatch, or None for unrelated hits (favicon, etc.).
fn handle_oauth_conn(stream: TcpStream, expected_state: &str) -> Option<Result<String, String>> {
    let mut reader = BufReader::new(&stream);
    let mut line = String::new();
    if reader.read_line(&mut line).is_err() {
        return None;
    }
    // "GET /?code=...&state=... HTTP/1.1"
    let path = line.split_whitespace().nth(1)?;
    let query = path.split_once('?').map(|(_, q)| q).unwrap_or("");
    if query_param(query, "code").is_none() && query_param(query, "error").is_none() {
        reply(&stream, "AFK Arena", "Waiting for sign-in…");
        return None;
    }

    let result = (|| {
        if let Some(err) = query_param(query, "error") {
            return Err(format!("Google returned: {err}"));
        }
        if query_param(query, "state").as_deref() != Some(expected_state) {
            return Err("State mismatch (possible tampering)".to_string());
        }
        query_param(query, "code").ok_or_else(|| "No authorization code".to_string())
    })();

    match &result {
        Ok(_) => reply(&stream, "✓ Signed in", "You're all set — return to AFK Arena."),
        Err(e) => reply(&stream, "Sign-in failed", e),
    }
    Some(result)
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
}

fn reply(mut stream: &TcpStream, title: &str, msg: &str) {
    let (title, msg) = (html_escape(title), html_escape(msg));
    let body = format!(
        "<!doctype html><meta charset=utf-8><title>{title}</title>\
         <body style=\"margin:0;height:100vh;display:grid;place-items:center;\
         font:600 16px system-ui;background:#14101f;color:#e7e2f5\">\
         <div style=\"text-align:center\"><div style=\"font-size:34px\">{title}</div>\
         <div style=\"opacity:.7;margin-top:8px\">{msg}</div></div>"
    );
    let resp = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\
         Content-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    let _ = stream.write_all(resp.as_bytes());
    let _ = stream.flush();
}

fn exchange_code(code: &str, verifier: &str, redirect_uri: &str) -> Result<String, String> {
    let resp = ureq::post("https://oauth2.googleapis.com/token").send_form(&[
        ("code", code),
        ("client_id", GOOGLE_CLIENT_ID),
        ("client_secret", GOOGLE_CLIENT_SECRET),
        ("redirect_uri", redirect_uri),
        ("grant_type", "authorization_code"),
        ("code_verifier", verifier),
    ]);
    let body = match resp {
        Ok(r) => r.into_string().map_err(|e| e.to_string())?,
        Err(ureq::Error::Status(_, r)) => {
            let b = r.into_string().unwrap_or_default();
            return Err(format!("Token exchange rejected: {b}"));
        }
        Err(e) => return Err(e.to_string()),
    };
    let v: serde_json::Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
    v.get("id_token")
        .and_then(|t| t.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Response had no id_token".to_string())
}

fn run_google_sign_in(app: &tauri::AppHandle) -> Result<String, String> {
    if GOOGLE_CLIENT_ID.is_empty() || GOOGLE_CLIENT_SECRET.is_empty() {
        return Err("Google sign-in is not configured (missing .env at build time).".into());
    }
    let verifier = random_b64url(32);
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let state = random_b64url(16);

    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect_uri = format!("http://127.0.0.1:{port}");

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=openid%20email%20profile&code_challenge={}&code_challenge_method=S256&state={}&prompt=select_account",
        GOOGLE_CLIENT_ID,
        percent_encode(&redirect_uri),
        challenge,
        state,
    );
    app.opener()
        .open_url(auth_url, None::<&str>)
        .map_err(|e| e.to_string())?;

    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let deadline = Instant::now() + Duration::from_secs(AUTH_TIMEOUT_SECS);
    let code = loop {
        if Instant::now() >= deadline {
            return Err("Sign-in timed out.".into());
        }
        match listener.accept() {
            Ok((stream, _)) => {
                let _ = stream.set_nonblocking(false);
                // Bound the read so a browser preconnect/speculative socket that
                // opens but never sends can't wedge us; a timed-out read returns
                // Err → handle_oauth_conn yields None → the outer deadline applies.
                let _ = stream.set_read_timeout(Some(Duration::from_millis(4000)));
                if let Some(res) = handle_oauth_conn(stream, &state) {
                    break res?;
                }
            }
            Err(e) if e.kind() == ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(120));
            }
            Err(e) => return Err(e.to_string()),
        }
    };
    exchange_code(&code, &verifier, &redirect_uri)
}

fn percent_encode(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}

/// Run the loopback Google OAuth flow and return the Google `id_token`, which the
/// frontend hands to Supabase `signInWithIdToken`. Blocking work runs off-thread.
#[tauri::command]
async fn google_sign_in(app: tauri::AppHandle) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || run_google_sign_in(&app))
        .await
        .map_err(|e| e.to_string())?
}

/// Hide the game into the menu-bar tray: window disappears and (on macOS) the
/// app leaves the Dock so it lives only as the dragon up top.
#[tauri::command]
fn hide_to_tray(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
}

/// Bring the game back from the tray.
fn show_main(app: &tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
        // Showing re-asserts tao's cached window state, which wipes the native
        // over-fullscreen flags — put them back if the setting is on.
        if FLOAT_OVER_FULLSCREEN.load(std::sync::atomic::Ordering::Relaxed) {
            let _ = win.set_visible_on_all_workspaces(true);
            apply_float_level(&win, true);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_nspanel::init())
        .invoke_handler(tauri::generate_handler![
            load_game,
            save_game,
            set_always_on_top,
            set_over_fullscreen,
            google_sign_in,
            hide_to_tray
        ])
        .setup(|app| {
            if let Some(win) = app.get_webview_window("main") {
                position_bottom_right(&win);
                let _ = win.show(); // config starts hidden to avoid a corner "jump"
            }
            // Float guard: AppKit/tao can silently reset our window level and
            // collection behavior on space switches, focus changes and shows.
            // While the over-fullscreen setting is on, re-assert the native
            // flags every 1.5s on the main thread — whatever wiped them loses.
            if let Some(win) = app.get_webview_window("main") {
                let guard_win = win.clone();
                std::thread::spawn(move || loop {
                    std::thread::sleep(Duration::from_millis(1500));
                    if FLOAT_OVER_FULLSCREEN.load(std::sync::atomic::Ordering::Relaxed) {
                        let w = guard_win.clone();
                        let _ = guard_win.run_on_main_thread(move || {
                            apply_float_level(&w, true);
                        });
                    }
                });
            }

            // Menu-bar dragon: left-click toggles the window back, right-click menus.
            let show = tauri::menu::MenuItem::with_id(app, "show", "Show Game", true, None::<&str>)?;
            let quit = tauri::menu::MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = tauri::menu::Menu::with_items(app, &[&show, &quit])?;
            tauri::tray::TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
