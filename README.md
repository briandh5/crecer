# Crecer — acompañamiento del desarrollo infantil

App n.º 3 del reto de 100 apps. Next.js 15 (App Router) + Tailwind CSS 3 + TypeScript + Recharts, pensada para Vercel y Supabase.

## Qué incluye

- **Dashboard** con selector de hijos (cambio rápido), anillos de crecimiento (camino a los 18 años, cartilla, hitos), próxima vacuna, último hito, última medición y curva compacta.
- **Crecimiento**: ficha de nacimiento, historial y gráfica interactiva de peso y talla contra la edad, con la mediana de referencia de la OMS (0–5 años).
- **Cartilla de vacunación** por rangos de edad: marcar aplicada, fecha, lote, lugar y recordatorio `.ics` de la siguiente dosis.
- **Hitos del desarrollo** por edad y área, con indicadores «dentro de lo esperado / vale la pena observar / conversa con tu pediatra».
- **Diario** de primeros logros y recuerdos.
- Multi-perfil, mobile-first, accesible (teclado, `aria`, contraste, `prefers-reduced-motion`).

Sistema de diseño «Naturaleza & Crecimiento»: `tailwind.config.ts`.

## Ejecutar

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # lógica de dominio (edades, vacunas, hitos, .ics)
npm run typecheck
npm run build
```

## Datos y Supabase

- **Hoy (modo demo)**: todo se guarda en `localStorage`, con dos perfiles de ejemplo. Los tipos de `src/lib/types.ts` reflejan las tablas.
- **Esquema**: `supabase/migrations/0001_schema.sql` (`profiles`, `children`, `measurements`, `vaccines`/`child_vaccines`, `milestones`/`child_milestones`, `journal_entries`) con RLS por dueño. Se ejecutó contra PostgreSQL 16 con un `auth` simulado para comprobar el trigger de la medición de nacimiento y que un usuario no ve ni escribe datos de otro.
- **Catálogos**: `src/data/vaccines.json` y `milestones.json` son la fuente única. `npm run db:seed` genera `supabase/seed.sql`.
- **Para conectar Supabase**: aplicar la migración y el seed, poner `NEXT_PUBLIC_SUPABASE_*` (ver `.env.example`) y sustituir las acciones de `src/lib/store.tsx` por llamadas a supabase-js; los componentes no cambian. Falta añadir el inicio de sesión.

## Límites que conviene saber

- Las medianas de `src/lib/growth-reference.ts` son aproximadas (OMS 2006, 0–5 años). Sustitúyelas por las tablas LMS oficiales antes de un uso clínico.
- El esquema de vacunas es una referencia basada en el calendario nacional de México; varía por país.
- Los hitos siguen la guía «Aprende los signos. Reacciona pronto» (CDC/AAP, 2022) hasta los 5 años; los de edades mayores son orientativos.
- La app orienta, no diagnostica.

## Vercel

Importa este repo en https://vercel.com/new; no hace falta configurar nada más (Framework: Next.js).
