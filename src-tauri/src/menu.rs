use tauri::menu::{MenuBuilder, SubmenuBuilder};
use tauri::AppHandle;

pub fn menu() -> tauri::menu::Menu {
    let app_menu = SubmenuBuilder::new(app, "私语 Siyu")
        .about(Some(Default::default()))
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()
        .unwrap();

    let edit_menu = SubmenuBuilder::new(app, "编辑")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()
        .unwrap();

    let view_menu = SubmenuBuilder::new(app, "视图")
        .fullscreen()
        .build()
        .unwrap();

    let window_menu = SubmenuBuilder::new(app, "窗口")
        .minimize()
        .build()
        .unwrap();

    MenuBuilder::new(app)
        .item(&app_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&window_menu)
        .build()
        .unwrap()
}
