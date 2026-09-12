export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function money(value) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function percent(value) {
  return `${Math.round(clamp(value, 0, 1) * 100)}%`;
}

export function formatClock(totalMinutes) {
  const mins = Math.floor(totalMinutes % (24 * 60));
  let hour = Math.floor(mins / 60);
  const minute = mins % 60;
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function choice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function weightedChoice(entries) {
  const total = entries.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of entries) {
    roll -= item.weight;
    if (roll <= 0) return item.value;
  }
  return entries[entries.length - 1].value;
}

export function rectContains(rect, x, y) {
  return x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
}

export function byId(items, id) {
  return items.find((item) => item.id === id);
}

export function uid(prefix) {
  uid.count = (uid.count || 0) + 1;
  return `${prefix}-${uid.count}`;
}

export function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
