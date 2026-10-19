import { addDays } from "./date.ts";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const compact = (iso: string) => iso.replaceAll("-", "");

/** Evento de día completo (.ics) con avisos 7 días y 1 día antes. Funciona con Google Calendar, Apple Calendar y Outlook. */
export function buildIcs(opts: { uid: string; title: string; date: string; description: string }): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Crecer//Cartilla de vacunacion//ES",
    "BEGIN:VEVENT",
    `UID:${opts.uid}@crecer.app`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(opts.date)}`,
    `DTEND;VALUE=DATE:${compact(addDays(opts.date, 1))}`,
    `SUMMARY:${esc(opts.title)}`,
    `DESCRIPTION:${esc(opts.description)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(opts.title)}`,
    "TRIGGER:-P7D",
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(opts.title)}`,
    "TRIGGER:-P1D",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function downloadFile(filename: string, content: string, type = "text/calendar;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
