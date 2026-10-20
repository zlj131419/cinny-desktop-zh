import { useEffect, useState } from 'react';

export const getNotificationState = (): PermissionState => {
  if ('Notification' in window) {
    if (window.Notification.permission === 'default') {
      return 'prompt';
    }

    return window.Notification.permission;
  }

  return 'denied';
};

export function usePermissionState(name: PermissionName, initialValue: PermissionState = 'prompt') {
  const [permissionState, setPermissionState] = useState<PermissionState>(initialValue);

  useEffect(() => {
    let permissionStatus: PermissionStatus;

    function handlePermissionChange(this: PermissionStatus) {
      setPermissionState(this.state);
    }

    let query: Promise<PermissionStatus>;
    try {
      query = navigator.permissions.query({ name });
    } catch {
      // 部分 WebView（如安卓）不支持某些权限名，query 会同步抛错：保持初始状态即可
      return;
    }
    query
      .then((permStatus: PermissionStatus) => {
        permissionStatus = permStatus;
        handlePermissionChange.apply(permStatus);
        if (typeof permStatus.addEventListener === 'function') {
          permStatus.addEventListener('change', handlePermissionChange);
        }
      })
      .catch(() => {
        // Silence error since FF doesn't support microphone permission
      });

    return () => {
      if (permissionStatus && typeof permissionStatus.removeEventListener === 'function') {
        permissionStatus.removeEventListener('change', handlePermissionChange);
      }
    };
  }, [name]);

  return permissionState;
}
