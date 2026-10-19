import { buildIcs, downloadFile } from "./ics";
import type { Child, VaccineDef } from "./types";
import { dueDate } from "./vaccines";

/** Descarga un .ics de día completo con avisos 7 y 1 día antes de la fecha recomendada de la vacuna. */
export function downloadVaccineReminder(child: Child, v: VaccineDef) {
  downloadFile(
    `vacuna-${v.id}.ics`,
    buildIcs({
      uid: `${child.id}-${v.id}`,
      title: `Vacuna de ${child.name}: ${v.name} (${v.dose})`,
      date: dueDate(child.birthDate, v),
      description: `Protege contra: ${v.protectsAgainst}. Fecha recomendada según el esquema de referencia.`,
    }),
  );
}
