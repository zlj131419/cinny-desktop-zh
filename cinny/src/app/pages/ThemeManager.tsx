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
 * 同步 Tauri 原生窗口（标题栏）的明暗主题
 * 使标题栏跟随应用内主题变色
 */
const syncTauriWindowTheme = (kind: ThemeKind) => {
  const theme = kind === ThemeKind.Dark ? 'dark' : 'light';
  const trySet = (attempts: number) => {
    try {
      const tauri = (window as any).__TAURI__;
      const win = tauri?.window?.getCurrentWindow?.();
      if (win?.setTheme) {
        win.setTheme(theme)?.catch?.(() => {});
        return;
      }
    } catch {
      // 忽略
    }
    // __TAURI__ 可能延迟注入，最多重试 10 次
    if (attempts < 10) {
      setTimeout(() => trySet(attempts + 1), 500);
    }
  };
  trySet(0);
};

export function UnAuthRouteThemeManager() {
  const systemThemeKind = useSystemThemeKind();

  useEffect(() => {
    document.body.className = '';
    document.body.classList.add(configClass, varsClass);
    if (systemThemeKind === ThemeKind.Dark) {
      document.body.classList.add(...DarkTheme.classNames);
    }
    if (systemThemeKind === ThemeKind.Light) {
      document.body.classList.add(...LightTheme.classNames);
    }
    syncTauriWindowTheme(systemThemeKind);
  }, [systemThemeKind]);

  return null;
}

export function AuthRouteThemeManager({ children }: { children: ReactNode }) {
  const activeTheme = useActiveTheme();
  const [monochromeMode] = useSetting(settingsAtom, 'monochromeMode');

  useEffect(() => {
    document.body.className = '';
    document.body.classList.add(configClass, varsClass);

    document.body.classList.add(...activeTheme.classNames);

    if (monochromeMode) {
      document.body.style.filter = 'grayscale(1)';
    } else {
      document.body.style.filter = '';
    }
    syncTauriWindowTheme(activeTheme.kind);
  }, [activeTheme, monochromeMode]);

  return <ThemeContextProvider value={activeTheme}>{children}</ThemeContextProvider>;
}
