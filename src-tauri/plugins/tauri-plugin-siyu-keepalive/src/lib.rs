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

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("siyu-keepalive")
        .invoke_handler(tauri::generate_handler![start, stop])
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
