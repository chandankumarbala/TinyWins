use std::{fs, path::PathBuf};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WebviewWindow, WindowEvent,
};

const RIGHT_PANEL_WIDTH: f64 = 440.0;

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())
}

fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("tiny-wins-state.json"))
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("tiny-wins-settings.json"))
}

fn atomic_write(path: PathBuf, content: String) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, content).map_err(|error| error.to_string())?;
    fs::rename(tmp, path).map_err(|error| error.to_string())
}

#[tauri::command]
fn load_state_file(app: AppHandle) -> Result<Option<String>, String> {
    let path = state_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(path).map(Some).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_state_file(app: AppHandle, content: String) -> Result<(), String> {
    atomic_write(state_path(&app)?, content)
}

#[tauri::command]
fn load_settings_file(app: AppHandle) -> Result<Option<String>, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(path).map(Some).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_settings_file(app: AppHandle, content: String) -> Result<(), String> {
    atomic_write(settings_path(&app)?, content)
}

fn main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window("main")
        .ok_or_else(|| "Main window is not available.".to_string())
}

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
    let window = main_window(&app)?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
fn set_always_on_top(app: AppHandle, enabled: bool) -> Result<(), String> {
    main_window(&app)?
        .set_always_on_top(enabled)
        .map_err(|error| error.to_string())
}

fn position_right_panel(window: &WebviewWindow) -> Result<(), String> {
    if let Some(monitor) = window.current_monitor().map_err(|error| error.to_string())? {
        let size = monitor.size();
        let position = monitor.position();
        let width = RIGHT_PANEL_WIDTH;
        let height = size.height as f64;
        window
            .set_size(tauri::Size::Logical(tauri::LogicalSize {
                width,
                height,
            }))
            .map_err(|error| error.to_string())?;
        window
            .set_position(tauri::Position::Logical(tauri::LogicalPosition {
                x: position.x as f64 + size.width as f64 - width,
                y: position.y as f64,
            }))
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let show = MenuItem::with_id(app, "show-hide", "Show/Hide Tiny Wins", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Tiny Wins", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            let window = app.get_webview_window("main").expect("main window");
            position_right_panel(&window)?;
            window.show()?;

            TrayIconBuilder::with_id("tiny-wins")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show-hide" => {
                        if let Ok(window) = main_window(app) {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = position_right_panel(&window);
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Ok(window) = main_window(app) {
                            let _ = position_right_panel(&window);
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            load_state_file,
            save_state_file,
            load_settings_file,
            save_settings_file,
            show_main_window,
            set_always_on_top
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tiny Wins");
}
