import assert from "node:assert/strict";
import { test } from "node:test";
import { addMonths, ageInMonths, ageParts, formatAge, formatMonths, relativeDays } from "../src/lib/date.ts";
import { checkpoints, currentCheckpoint, domainState, lastAchieved, overallState, summarize } from "../src/lib/milestones.ts";
import { referenceMedian } from "../src/lib/growth-reference.ts";
import { stageFor, stageProgress } from "../src/lib/stage.ts";
import { cardProgress, nextDoseInSeries, nextVaccine, vaccineStatus } from "../src/lib/vaccines.ts";
import { buildIcs } from "../src/lib/ics.ts";
import type { MilestoneDef, VaccineDef } from "../src/lib/types.ts";

test("addMonths ajusta fin de mes y cruza de año", () => {
  assert.equal(addMonths("2024-01-31", 1), "2024-02-29");
  assert.equal(addMonths("2023-01-31", 1), "2023-02-28");
  assert.equal(addMonths("2025-11-15", 3), "2026-02-15");
  assert.equal(addMonths("2025-03-10", -4), "2024-11-10");
});

test("edad: meses completos, antes y después del cumplemes", () => {
  assert.deepEqual(ageParts("2024-06-15", "2026-10-14"), { years: 2, months: 3, days: 29 });
  assert.equal(ageInMonths("2024-06-15", "2026-10-15"), 28);
  assert.equal(formatAge("2024-06-15", "2026-10-15"), "2 años 4 meses");
  assert.equal(formatAge("2026-10-01", "2026-10-11"), "10 días");
  assert.equal(formatAge("2026-10-17", "2026-10-17"), "Recién nacido/a");
  assert.equal(formatAge("2025-10-17", "2026-10-17"), "1 año");
  assert.equal(ageInMonths("2026-10-17", "2026-01-01"), 0, "fecha de referencia anterior al nacimiento");
});

test("formatMonths y relativeDays", () => {
  assert.equal(formatMonths(9), "9 meses");
  assert.equal(formatMonths(30), "2 años y medio");
  assert.equal(formatMonths(48), "4 años");
  assert.equal(relativeDays("2026-10-20", "2026-10-17"), "en 3 días");
  assert.equal(relativeDays("2026-10-10", "2026-10-17"), "hace 7 días");
  assert.equal(relativeDays("2027-01-17", "2026-10-17"), "en 3 meses");
});

test("etapas: brote → arbolito → árbol", () => {
  assert.equal(stageFor(0).id, "brote");
  assert.equal(stageFor(23).id, "brote");
  assert.equal(stageFor(24).id, "arbolito");
  assert.equal(stageFor(119).id, "arbolito");
  assert.equal(stageFor(120).id, "arbol");
  assert.equal(stageFor(400).id, "arbol");
  assert.equal(stageProgress(12), 0.5);
  assert.equal(stageProgress(400), 1);
});

const vaccines: VaccineDef[] = [
  { id: "a-1", series: "a", name: "A", dose: "1", protectsAgainst: "", dueMonth: 2, group: "0-2m" },
  { id: "a-2", series: "a", name: "A", dose: "2", protectsAgainst: "", dueMonth: 4, group: "4m" },
  { id: "b-1", series: "b", name: "B", dose: "1", protectsAgainst: "", dueMonth: 12, group: "12-18m" },
  { id: "o-1", series: "o", name: "Opcional", dose: "1", protectsAgainst: "", dueMonth: 12, group: "12-18m", optional: true },
];
const rec = (vaccineId: string) => ({ childId: "c", vaccineId, appliedAt: "2026-01-01", lot: "", place: "" });

test("estado de vacuna según ventana de ±30 días", () => {
  const birth = "2026-01-01"; // a-2 vence 2026-05-01
  assert.equal(vaccineStatus(vaccines[1], undefined, birth, "2026-03-01"), "upcoming");
  assert.equal(vaccineStatus(vaccines[1], undefined, birth, "2026-04-15"), "due");
  assert.equal(vaccineStatus(vaccines[1], undefined, birth, "2026-05-25"), "due");
  assert.equal(vaccineStatus(vaccines[1], undefined, birth, "2026-06-15"), "overdue");
  assert.equal(vaccineStatus(vaccines[1], rec("a-2"), birth, "2026-06-15"), "applied");
  assert.equal(vaccineStatus(vaccines[3], undefined, birth, "2030-01-01"), "optional");
});

test("próxima vacuna, serie y avance de cartilla", () => {
  assert.equal(nextVaccine(vaccines, [])?.id, "a-1");
  assert.equal(nextVaccine(vaccines, [rec("a-1"), rec("a-2")])?.id, "b-1");
  assert.equal(nextVaccine(vaccines, [rec("a-1"), rec("a-2"), rec("b-1")]), null, "las opcionales no cuentan");
  assert.equal(nextDoseInSeries(vaccines, vaccines[0])?.id, "a-2");
  assert.equal(nextDoseInSeries(vaccines, vaccines[1]), null);
  const p = cardProgress(vaccines, [rec("a-1")], "2026-01-01", "2026-04-10");
  assert.deepEqual([p.applied, p.expected], [1, 2]);
  // Nada vence todavía → no hay nada atrasado: avance completo.
  const none = cardProgress(vaccines, [], "2026-10-01", "2026-10-02");
  assert.deepEqual([none.expected, none.ratio], [0, 1]);
  assert.equal(cardProgress(vaccines, [], "2026-01-01", "2026-04-10").ratio, 0);
});

const milestones: MilestoneDef[] = [
  { id: "mg-2-1", domain: "mg", month: 2, text: "x" },
  { id: "mg-4-1", domain: "mg", month: 4, text: "x" },
  { id: "mg-6-1", domain: "mg", month: 6, text: "x" },
  { id: "le-2-1", domain: "le", month: 2, text: "x" },
  { id: "le-12-1", domain: "le", month: 12, text: "x" },
];
const mrec = (milestoneId: string, achievedAt = "2026-01-01") => ({ childId: "c", milestoneId, achievedAt });

test("estado de desarrollo por dominio (margen de 2 meses)", () => {
  assert.equal(domainState(0, 0), "pending-data");
  assert.equal(domainState(5, 4), "expected");
  assert.equal(domainState(5, 3), "watch");
  assert.equal(domainState(5, 2), "consult");
  // Con 6 meses: mg-2 y mg-4 son evaluables (2+2 ≤ 6, 4+2 ≤ 6); mg-6 aún no.
  const s = summarize(milestones, [mrec("mg-2-1")], 6);
  const mg = s.find((d) => d.domain === "mg")!;
  assert.deepEqual([mg.evaluable, mg.achieved, mg.state], [2, 1, "watch"]);
  const le = s.find((d) => d.domain === "le")!;
  assert.deepEqual([le.evaluable, le.achieved, le.state], [1, 0, "consult"]);
  assert.equal(overallState(s), "consult");
  assert.equal(overallState(summarize(milestones, [], 1)), "pending-data");
});

test("controles y último hito", () => {
  const pts = checkpoints(milestones);
  assert.deepEqual(pts, [2, 4, 6, 12]);
  assert.equal(currentCheckpoint(pts, 5), 4);
  assert.equal(currentCheckpoint(pts, 1), 2);
  assert.equal(currentCheckpoint(pts, 99), 12);
  const last = lastAchieved(milestones, [mrec("mg-2-1", "2026-03-01"), mrec("le-12-1", "2026-02-01"), mrec("zz", "2027-01-01")]);
  assert.equal(last?.def.id, "mg-2-1");
  assert.equal(lastAchieved(milestones, []), null);
});

test("referencia OMS: interpola y se corta a los 5 años", () => {
  assert.equal(referenceMedian("weight", "male", 0), 3.3);
  assert.equal(referenceMedian("weight", "male", 60), 18.3);
  assert.equal(referenceMedian("weight", "male", 61), null);
  const mid = referenceMedian("height", "female", 7.5)!; // entre 6 m (65.7) y 9 m (70.1)
  assert.ok(mid > 65.7 && mid < 70.1);
  const avg = referenceMedian("weight", "unspecified", 12)!;
  assert.ok(Math.abs(avg - (9.6 + 8.9) / 2) < 1e-9);
});

test("ICS: formato mínimo válido", () => {
  const ics = buildIcs({ uid: "x", title: "Vacuna; Hexa, 2.ª", date: "2026-12-31", description: "a\nb" });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261231/);
  assert.match(ics, /DTEND;VALUE=DATE:20270101/);
  assert.match(ics, /SUMMARY:Vacuna\; Hexa\\, 2\.ª/);
  assert.match(ics, /DESCRIPTION:a\\nb/);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});
