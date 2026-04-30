const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function formatDayHeader(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日 · ${WEEKDAYS[d.getDay()]}`;
}

export function formatDate(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAYS[d.getDay()]}`;
}

export function formatTimeRange(start: Date, end: Date): string {
  return `${pad(start.getHours())}:${pad(start.getMinutes())} — ${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

export function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatCountdown(msUntil: number): string {
  if (msUntil <= 0) return "现在";
  const totalMinutes = Math.floor(msUntil / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `距离开始还有 ${days} 天 ${remHours} 小时`;
  }
  if (hours > 0) {
    return `距离开始还有 ${hours} 小时 ${minutes} 分钟`;
  }
  return `距离开始还有 ${minutes} 分钟`;
}
