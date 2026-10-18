import React, { ReactNode, useEffect } from 'react';
import { configClass, varsClass } from 'folds';
import {
  DarkTheme,
  LightTheme,
  ThemeContextProvider,
  ThemeKind,
  useActiveTheme,
  useSystemThemeKind,
} from '../hooks/useTheme';
import { useSetting } from '../state/hooks/settings';
import { settingsAtom } from '../state/settings';

/**
 * 把主题 class 应用到 body 和 portal 容器
 * portal 容器（PopOut/Tooltip/Overlay 的挂载点）是 body 的直接子节点，
 * 理论上会继承 body 的 CSS 变量，但某些情况下（如 Tauri webview）继承链可能断裂，
 * 因此显式地把主题 class 也加到 portal 容器上，确保下拉菜单等跟随主题变色。
 */
const applyThemeClasses = (classNames: string[]) => {
  document.body.className = '';
  document.body.classList.add(configClass, varsClass, ...classNames);
  const portalContainer = document.getElementById('portalContainer');
  if (portalContainer) {
    portalContainer.className = '';
    portalContainer.classList.add(...classNames);
  }
};

/**
 * 同步 Tauri 原生窗口（标题栏）的明暗主题
 * 使标题栏跟随应用内主题变色
 */
const syncTauriWindowTheme = (kind: ThemeKind) => {
  const theme = kind === ThemeKind.Dark ? 'dark' : 'light';
  const trySet = (attempts: number) => {
    try {
      const tauri = (window as any).__TAURI__;
      // Tauri v2: 优先用 @tauri-apps/api 的 window 命名空间，其次尝试 core.invoke
      const win = tauri?.window?.getCurrentWindow?.();
      if (win?.setTheme) {
        Promise.resolve(win.setTheme(theme)).catch(() => {
          // setTheme 失败时，尝试用 invoke 直接调窗口主题命令
          tauri?.core?.invoke?.('plugin:window|set_theme', { theme }).catch?.(() => {});
        });
        return;
      }
      // window 命名空间不可用时，直接用 invoke
      if (tauri?.core?.invoke) {
        tauri.core.invoke('plugin:window|set_theme', { theme }).catch?.(() => {});
        return;
      }
    } catch {
      // 忽略
    }
    // __TAURI__ 可能延迟注入，最多重试 20 次（10 秒）
    if (attempts < 20) {
      setTimeout(() => trySet(attempts + 1), 500);
    }
  };
  trySet(0);
};

export function UnAuthRouteThemeManager() {
  const systemThemeKind = useSystemThemeKind();

  useEffect(() => {
    if (systemThemeKind === ThemeKind.Dark) {
      applyThemeClasses(DarkTheme.classNames);
    }
    if (systemThemeKind === ThemeKind.Light) {
      applyThemeClasses(LightTheme.classNames);
    }
    syncTauriWindowTheme(systemThemeKind);
  }, [systemThemeKind]);

  return null;
}

export function AuthRouteThemeManager({ children }: { children: ReactNode }) {
  const activeTheme = useActiveTheme();
  const [monochromeMode] = useSetting(settingsAtom, 'monochromeMode');

  useEffect(() => {
    applyThemeClasses(activeTheme.classNames);

    if (monochromeMode) {
      document.body.style.filter = 'grayscale(1)';
    } else {
      document.body.style.filter = '';
    }
    syncTauriWindowTheme(activeTheme.kind);
  }, [activeTheme, monochromeMode]);

  return <ThemeContextProvider value={activeTheme}>{children}</ThemeContextProvider>;
}
