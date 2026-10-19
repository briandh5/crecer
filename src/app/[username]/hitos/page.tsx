"use client";

import { ChildPage } from "@/components/Page";
import { MilestoneChecklist } from "@/components/MilestoneChecklist";

export default function MilestonesPage() {
  return (
    <ChildPage title="Hitos del desarrollo" intro="Marca lo que ya logra en motricidad, lenguaje, emociones y pensamiento, y mira si va dentro de lo esperado para su edad.">
      {(child) => <MilestoneChecklist child={child} />}
    </ChildPage>
  );
}
