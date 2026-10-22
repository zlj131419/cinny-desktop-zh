const COMMANDS: &[&str] = &["start", "stop", "top_inset", "request_microphone"];

fn main() {
    let result = tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .try_build();

    // when building documentation for Android the plugin build result is always Err() (docs.rs mounts the sources read-only) and is irrelevant to the crate documentation build
    // `cfg(docsrs)` only reaches rustdoc, build scripts must check the `DOCS_RS` env var instead
    if !(std::env::var_os("DOCS_RS").is_some()
        && std::env::var("TARGET").unwrap().contains("android"))
    {
        result.unwrap();
    }
}
