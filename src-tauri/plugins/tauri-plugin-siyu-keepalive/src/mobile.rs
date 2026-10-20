use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "net.xxqw.siyu.keepalive";

pub struct SiyuKeepalive<R: Runtime>(Option<PluginHandle<R>>);

/// 注册安卓侧 Kotlin 插件类。非安卓移动端（未发布）不注册任何实现，命令为空操作。
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<SiyuKeepalive<R>, String> {
    #[cfg(target_os = "android")]
    let handle = api
        .register_android_plugin(PLUGIN_IDENTIFIER, "KeepAlivePlugin")
        .map_err(|e| e.to_string())?;
    #[cfg(not(target_os = "android"))]
    let handle = {
        let _ = api;
        None
    };
    #[cfg(target_os = "android")]
    return Ok(SiyuKeepalive(Some(handle)));
    #[cfg(not(target_os = "android"))]
    return Ok(SiyuKeepalive(None));
}

impl<R: Runtime> SiyuKeepalive<R> {
    pub fn start(&self) -> Result<(), String> {
        if let Some(handle) = &self.0 {
            handle
                .run_mobile_plugin::<serde_json::Value>("startService", serde_json::json!({}))
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn stop(&self) -> Result<(), String> {
        if let Some(handle) = &self.0 {
            handle
                .run_mobile_plugin::<serde_json::Value>("stopService", serde_json::json!({}))
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}
