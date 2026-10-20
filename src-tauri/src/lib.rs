#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

// mod menu;

use tauri::{webview::{NewWindowResponse, WebviewWindowBuilder}, WebviewUrl, TitleBarStyle};
#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri::{Manager, WindowEvent};
use tauri_plugin_opener::OpenerExt;

#[cfg(all(feature = "updater", desktop))]
use tauri_plugin_updater::UpdaterExt;
#[cfg(all(feature = "updater", desktop))]
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    
    for key in ["NO_PROXY", "no_proxy"] {
        let current_val = std::env::var(key).unwrap_or_default();
        if !current_val.contains("localhost") {
            let new_val = if current_val.is_empty() {
                "localhost,127.0.0.1".to_string()
            } else {
                format!("{},localhost,127.0.0.1", current_val)
            };
            std::env::set_var(key, new_val);
        }
    }

    let port: u16 = 44548;
    let context = tauri::generate_context!();
    let mut builder = tauri::Builder::default();

    // #[cfg(target_os = "macos")]
    // {
    //     builder = builder.menu(menu::menu());
    // }

    #[cfg(all(feature = "updater", desktop))]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 已有实例在运行：恢复主窗口，而不是开新窗口
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }));
    }

    builder = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_localhost::Builder::new(port).build());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_window_state::Builder::default().build());
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_siyu_keepalive::init())
        .setup(move |app| {
            #[cfg(all(feature = "updater", desktop))]
            {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let updater = match handle.updater() {
                        Ok(u) => u,
                        Err(e) => {
                            eprintln!("Updater not available: {}", e);
                            return;
                        }
                    };
                    if let Ok(Some(update)) = updater.check().await {
                        let version = update.version.clone();

                        // 1. 先在后台自动下载新版本，下载过程不打扰用户
                        match update.download(|_, _| {}, || {}).await {
                            Ok(bytes) => {
                                // 2. 下载完成后才提示：点更新即自动升级
                                let do_update = handle
                                    .dialog()
                                    .message(format!(
                                        "新版本 {} 已下载完成\n\n点击更新将自动完成升级并重新打开私语",
                                        version
                                    ))
                                    .title("新版本已就绪")
                                    .kind(MessageDialogKind::Info)
                                    .buttons(MessageDialogButtons::YesNo)
                                    .blocking_show();

                                // 3. 确认后自动安装并重启到新版本
                                if do_update {
                                    if update.install(bytes).is_ok() {
                                        handle.restart();
                                    }
                                }
                            }
                            Err(e) => {
                                eprintln!("Update download failed: {}", e);
                            }
                        }
                    }
                });
            }

            // Dev: use devUrl from tauri.conf.json (http://localhost:8080) to support HMR
            #[cfg(debug_assertions)]
            let window_url = WebviewUrl::App(Default::default());

            // Release: tauri-plugin-localhost serves bundled frontend assets on this port
            #[cfg(not(debug_assertions))]
            let window_url = {
                let url = format!("http://localhost:{}", port).parse().unwrap();
                WebviewUrl::External(url)
            };

            let app_handle = app.handle().clone();
            let window_builder = WebviewWindowBuilder::new(app, "main".to_string(), window_url)
                .title("私语 Siyu")
                .disable_drag_drop_handler()
                .on_new_window(move |url, _features| {
                    let _ = app_handle.opener().open_url(url.as_str(), None::<&str>);
                    NewWindowResponse::Deny
                });

            #[cfg(target_os = "macos")]
            let window_builder = window_builder.title_bar_style(TitleBarStyle::Transparent);

            let main_window = window_builder.build()?;

            // 点 X 不退出，改为隐藏到托盘（v2 的 Builder 没有 on_window_event，用 Window 的）
            {
                let w = main_window.clone();
                let _ = main_window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        let _ = w.hide();
                        api.prevent_close();
                    }
                });
            }

            // 系统托盘：左键单击恢复窗口，右键菜单显示/退出（仅桌面端）
            #[cfg(desktop)]
            {
                let app_handle = app.handle();
            if let Some(icon) = app_handle.default_window_icon().cloned() {
                let show_item = MenuItem::with_id(app_handle, "tray-show", "显示窗口", true, None::<&str>)?;
                let quit_item = MenuItem::with_id(app_handle, "tray-quit", "退出", true, None::<&str>)?;
                let tray_menu = Menu::with_items(app_handle, &[&show_item, &quit_item])?;
                TrayIconBuilder::new()
                    .icon(icon)
                    .tooltip("私语 Siyu")
                    .menu(&tray_menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "tray-show" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "tray-quit" => app.exit(0),
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
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    })
                    .build(app_handle)?;
                }
            }
            Ok(())
        })
        .run(context)
        .expect("error while building tauri application");
}
