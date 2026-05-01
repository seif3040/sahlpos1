export function formatMoney(n: number, currency = "ج.م") {
  const v = Number.isFinite(n) ? n : 0;
  return `${v.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ${currency}`;
}

export function formatDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDay(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

export function roleLabel(r: string) {
  return r === "owner" ? "صاحب المحل" : r === "manager" ? "مدير" : "كاشير";
}
