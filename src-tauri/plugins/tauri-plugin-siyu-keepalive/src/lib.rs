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

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("siyu-keepalive")
        .invoke_handler(tauri::generate_handler![start, stop, top_inset, request_microphone])
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
