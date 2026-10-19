"use client";

import { Journal } from "@/components/Journal";
import { ChildPage } from "@/components/Page";

export default function JournalPage() {
  return (
    <ChildPage title="Diario de primeros logros" intro="Los momentos que no quieres olvidar: primeras veces, frases graciosas y pequeños milagros.">
      {(child) => <Journal child={child} />}
    </ChildPage>
  );
}
