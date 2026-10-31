// Web 系统通知封装
// - 借药提醒 / 过期提醒 两个开关的状态存于 localStorage（yaolin_notif_borrow / yaolin_notif_expiry）
// - 仅在浏览器 Notification 权限为 granted 且对应开关开启时才真正弹出系统通知

export type NotifKind = 'borrow' | 'expiry';

const KEY_PREFIX = 'yaolin_notif_';

function storageKey(kind: NotifKind): string {
  return `${KEY_PREFIX}${kind}`;
}

/** 读取某类提醒的开关状态（默认开启） */
export function notifEnabled(kind: NotifKind): boolean {
  return localStorage.getItem(storageKey(kind)) !== 'false';
}

/** 设置某类提醒的开关状态（true=开启） */
export function setNotifEnabled(kind: NotifKind, enabled: boolean): void {
  localStorage.setItem(storageKey(kind), String(enabled));
}

/** 浏览器是否支持系统通知 */
function supported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** 申请系统通知权限，返回最终是否为 granted */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!supported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const p = await Notification.requestPermission();
    return p === 'granted';
  } catch {
    return false;
  }
}

/**
 * 弹出系统通知。
 * 内部会先判断支持性、权限与开关状态，只有全部满足才弹。
 */
export function pushNotification(kind: NotifKind, title: string, body: string): void {
  if (!supported()) return;
  if (Notification.permission !== 'granted') return;
  if (!notifEnabled(kind)) return;
  try {
    const n = new Notification(title, { body, icon: '/images/logo.png' });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // 某些移动端浏览器构造 Notification 可能抛错，忽略
  }
}