#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

// mod menu;

use tauri::{webview::{NewWindowResponse, WebviewWindowBuilder}, WebviewUrl, TitleBarStyle};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_opener::OpenerExt;

#[cfg(feature = "updater")]
use tauri_plugin_updater::UpdaterExt;
#[cfg(feature = "updater")]
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

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
    #[cfg(feature = "updater")]
    let mut builder = tauri::Builder::default();
    #[cfg(not(feature = "updater"))]
    let builder = tauri::Builder::default();

    // #[cfg(target_os = "macos")]
    // {
    //     builder = builder.menu(menu::menu());
    // }

    #[cfg(feature = "updater")]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 已有实例在运行：恢复主窗口，而不是开新窗口
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_localhost::Builder::new(port).build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            #[cfg(feature = "updater")]
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

                        let should_update = handle
                            .dialog()
                            .message(format!(
                                "发现新版本 {}\n\n现在更新吗？",
                                version
                            ))
                            .title("发现新版本")
                            .kind(MessageDialogKind::Info)
                            .buttons(MessageDialogButtons::YesNo)
                            .blocking_show();

                        if should_update {
                            if update.download_and_install(|_, _| {}, || {}).await.is_ok() {
                                handle.restart();
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
                .title("Cinny")
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

            // 系统托盘：左键单击恢复窗口，右键菜单显示/退出
            let app_handle = app.handle();
            if let Some(icon) = app_handle.default_window_icon().cloned() {
                let show_item = MenuItem::with_id(app_handle, "tray-show", "显示窗口", true, None::<&str>)?;
                let quit_item = MenuItem::with_id(app_handle, "tray-quit", "退出", true, None::<&str>)?;
                let tray_menu = Menu::with_items(app_handle, &[&show_item, &quit_item])?;
                TrayIconBuilder::new()
                    .icon(icon)
                    .tooltip("Cinny")
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
            Ok(())
        })
        .run(context)
        .expect("error while building tauri application");
}
