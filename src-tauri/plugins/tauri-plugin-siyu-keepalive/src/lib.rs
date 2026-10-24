use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

#[cfg(mobile)]
mod mobile;

#[cfg(mobile)]
use mobile::SiyuKeepalive;

/// 启动安卓前台保活服务。桌面端没有这个概念，直接成功返回。
#[tauri::command]
async fn start<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    #[cfg(mobile)]
    {
        let handle = app.state::<SiyuKeepalive<R>>();
        handle.start()?;
    }
    #[cfg(not(mobile))]
    let _ = &app;
    Ok(())
}

/// 停止安卓前台保活服务（退出登录时调用）。
#[tauri::command]
async fn stop<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    #[cfg(mobile)]
    {
        let handle = app.state::<SiyuKeepalive<R>>();
        handle.stop()?;
    }
    #[cfg(not(mobile))]
    let _ = &app;
    Ok(())
}

/// 量 WebView 顶部被状态栏挡住的高度（CSS px）。桌面端恒为 0。
#[tauri::command]
async fn top_inset<R: Runtime>(app: tauri::AppHandle<R>) -> Result<f64, String> {
    #[cfg(mobile)]
    {
        let handle = app.state::<SiyuKeepalive<R>>();
        return handle.top_inset();
    }
    #[cfg(not(mobile))]
    {
        let _ = &app;
        Ok(0.0)
    }
}

/// 请求安卓录音运行时权限（点录音按钮时调；未授权会弹系统授权框）。
/// 返回调用前是否已授权。桌面端恒为 false（桌面不需要）。
#[tauri::command]
async fn request_microphone<R: Runtime>(app: tauri::AppHandle<R>) -> Result<bool, String> {
    #[cfg(mobile)]
    {
        let handle = app.state::<SiyuKeepalive<R>>();
        return handle.request_microphone();
    }
    #[cfg(not(mobile))]
    {
        let _ = &app;
        Ok(false)
    }
}

/// 设置应用图标未读角标数（0=清除）。计数与各端共用同一来源：全部未读总数。
/// - 安卓：插件 Kotlin 实现（华为 change_badge + 广播兜底）
/// - Windows：系统没有数字角标 API，用任务栏覆盖图标实现（运行时绘制数字
///   徽章图，见 badge_image；>9 显示 9+，0 清除覆盖图）
/// - macOS：窗口原生角标（Dock 图标）
#[tauri::command]
async fn set_badge<R: Runtime>(app: tauri::AppHandle<R>, count: i32) -> Result<bool, String> {
    #[cfg(mobile)]
    {
        let handle = app.state::<SiyuKeepalive<R>>();
        return handle.set_badge(count);
    }
    #[cfg(not(mobile))]
    {
        #[cfg(target_os = "windows")]
        {
            let Some(window) = app.get_webview_window("main") else {
                return Ok(false);
            };
            let icon = if count > 0 {
                Some(badge_image(count))
            } else {
                None
            };
            return window
                .set_overlay_icon(icon.as_ref())
                .map(|_| true)
                .map_err(|e| e.to_string());
        }
        #[cfg(target_os = "macos")]
        {
            let Some(window) = app.get_webview_window("main") else {
                return Ok(false);
            };
            let value = if count > 0 { Some(count as i64) } else { None };
            return window
                .set_badge_count(value)
                .map(|_| true)
                .map_err(|e| e.to_string());
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            let _ = &app;
            let _ = count;
            Ok(false)
        }
    }
}

/// Windows 任务栏角标图：48×48 RGBA，红底白字、白圈边。
/// 数字用 3×5 点阵字放大 4 倍绘制（覆盖图在任务栏上只显示约 16px，
/// 点阵字足够清晰），>9 显示「9+」。
#[cfg(all(not(mobile), target_os = "windows"))]
fn badge_image(count: i32) -> tauri::image::Image<'static> {
    const S: i32 = 48;
    let mut rgba = vec![0u8; (S * S * 4) as usize];
    let center = S as f32 / 2.0;
    for y in 0..S {
        for x in 0..S {
            let dx = x as f32 + 0.5 - center;
            let dy = y as f32 + 0.5 - center;
            let dist = (dx * dx + dy * dy).sqrt();
            let i = ((y * S + x) * 4) as usize;
            if dist <= 20.0 {
                rgba[i] = 240;
                rgba[i + 1] = 68;
                rgba[i + 2] = 56;
                rgba[i + 3] = 255;
            } else if dist <= 23.0 {
                rgba[i] = 255;
                rgba[i + 1] = 255;
                rgba[i + 2] = 255;
                rgba[i + 3] = if dist <= 22.0 { 255 } else { 110 };
            }
        }
    }
    let label: Vec<u8> = if count > 9 {
        vec![b'9', b'+']
    } else {
        vec![b'0' + count as u8]
    };
    let scale = 4i32;
    let text_w = label.len() as i32 * (3 * scale + 2) - 2;
    let start_x = (S - text_w) / 2;
    let start_y = (S - 5 * scale) / 2;
    for (ci, ch) in label.iter().enumerate() {
        let glyph = glyph_3x5(*ch);
        for row in 0..5i32 {
            for col in 0..3i32 {
                if glyph[(row * 3 + col) as usize] == 0 {
                    continue;
                }
                for sy in 0..scale {
                    for sx in 0..scale {
                        let px = start_x + ci as i32 * (3 * scale + 2) + col * scale + sx;
                        let py = start_y + row * scale + sy;
                        let i = ((py * S + px) * 4) as usize;
                        rgba[i] = 255;
                        rgba[i + 1] = 255;
                        rgba[i + 2] = 255;
                        rgba[i + 3] = 255;
                    }
                }
            }
        }
    }
    tauri::image::Image::new_owned(rgba, S as u32, S as u32)
}

/// 3×5 点阵字形（行主序，每行 3 点）。
#[cfg(all(not(mobile), target_os = "windows"))]
fn glyph_3x5(ch: u8) -> [u8; 15] {
    match ch {
        b'1' => [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
        b'2' => [1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1],
        b'3' => [1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1],
        b'4' => [1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0, 0, 1],
        b'5' => [1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 1],
        b'6' => [1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1],
        b'7' => [1, 1, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0],
        b'8' => [1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1],
        b'9' => [1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1],
        b'+' => [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0],
        _ => [0; 15],
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("siyu-keepalive")
        .invoke_handler(tauri::generate_handler![
            start,
            stop,
            top_inset,
            request_microphone,
            set_badge
        ])
        .setup(|app, api| {
            #[cfg(mobile)]
            {
                let handle = mobile::init(app, api).map_err(|e| e.to_string())?;
                app.manage(handle);
            }
            #[cfg(not(mobile))]
            {
                let _ = app;
                let _ = api;
            }
            Ok(())
        })
        .build()
}
