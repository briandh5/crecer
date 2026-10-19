"use client";

import { ChildPage } from "@/components/Page";
import { VaccinationCard } from "@/components/VaccinationCard";

export default function VaccinesPage() {
  return (
    <ChildPage title="Cartilla de vacunación" intro="Toca el círculo para marcar una dosis como aplicada. Después puedes anotar la fecha, el lote y dónde se aplicó.">
      {(child) => <VaccinationCard child={child} />}
    </ChildPage>
  );
}
