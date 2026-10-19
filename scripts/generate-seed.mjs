// Genera supabase/seed.sql a partir de los catálogos JSON que también usa la app,
// para que el esquema de vacunas y los hitos tengan una sola fuente de verdad.
//   npm run db:seed   → supabase/seed.sql (solo catálogos) y supabase/setup.sql (esquema + catálogos)
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const vaccines = JSON.parse(readFileSync(new URL("src/data/vaccines.json", root), "utf8"));
const milestones = JSON.parse(readFileSync(new URL("src/data/milestones.json", root), "utf8"));

const q = (s) => `'${String(s).replaceAll("'", "''")}'`;

const vaccineRows = vaccines
  .map(
    (v, i) =>
      `  (${q(v.id)}, ${q(v.series)}, ${q(v.name)}, ${q(v.dose)}, ${q(v.protectsAgainst)}, ${v.dueMonth}, ${q(v.group)}, ${v.optional ? "true" : "false"}, ${i})`,
  )
  .join(",\n");

const milestoneRows = milestones
  .map((m) => `  (${q(m.id)}, ${q(m.domain)}, ${m.month}, ${q(m.text)})`)
  .join(",\n");

const sql = `-- GENERADO por scripts/generate-seed.mjs — no editar a mano (edita src/data/*.json y ejecuta \`npm run db:seed\`).
-- Esquema de vacunación de referencia: revísalo con tu pediatra / autoridad sanitaria; varía por país.

insert into public.vaccines (id, series, name, dose, protects_against, due_month, group_id, optional, sort_order) values
${vaccineRows}
on conflict (id) do update set
  series = excluded.series, name = excluded.name, dose = excluded.dose,
  protects_against = excluded.protects_against, due_month = excluded.due_month,
  group_id = excluded.group_id, optional = excluded.optional, sort_order = excluded.sort_order;

insert into public.milestones (id, domain, month, text) values
${milestoneRows}
on conflict (id) do update set domain = excluded.domain, month = excluded.month, text = excluded.text;
`;

writeFileSync(new URL("supabase/seed.sql", root), sql);

// setup.sql = esquema + catálogos en un solo archivo, para pegarlo de una vez en el SQL Editor de Supabase.
// Incluye todas las migraciones en orden. Quien ya tenga una versión anterior solo ejecuta las migraciones nuevas.
const migrations = readdirSync(new URL("supabase/migrations/", root))
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => `-- ===== ${f} =====\n\n${readFileSync(new URL(`supabase/migrations/${f}`, root), "utf8")}`)
  .join("\n");
writeFileSync(new URL("supabase/setup.sql", root), `${migrations}\n-- ===== Catálogos =====\n\n${sql}`);

console.log(`supabase/seed.sql y setup.sql: ${vaccines.length} vacunas, ${milestones.length} hitos`);
