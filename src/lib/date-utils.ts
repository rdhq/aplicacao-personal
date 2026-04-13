export function getCurrentMonday(): Date {
  const today = new Date();
  const day = today.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // days since Monday
  const monday = new Date(today);
  monday.setDate(today.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function getMondayByOffset(offset: number): Date {
  const monday = getCurrentMonday();
  monday.setDate(monday.getDate() + offset * 7);
  return monday;
}

export function getWeekDates(baseMonday: Date) {
  const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const labels = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  return days.map((key, i) => {
    const d = new Date(baseMonday);
    d.setDate(baseMonday.getDate() + i);
    return { key, label: labels[i], date: String(d.getDate()), fullDate: d };
  });
}

export function formatWeekRange(baseMonday: Date) {
  const end = new Date(baseMonday);
  end.setDate(baseMonday.getDate() + 5);
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  return `${fmt(baseMonday)} — ${fmt(end)}`;
}

export function formatDateBR(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function dayOfWeekKey(d: Date): string {
  const keys = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return keys[d.getDay()];
}

export function generateTimeSlots(start: string, end: string, duration: number): string[] {
  const slots: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let t = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (t + duration <= endMin) {
    slots.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
    t += duration;
  }
  return slots;
}
