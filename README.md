# Crecer — acompañamiento del desarrollo infantil

App n.º 3 del reto de 100 apps. Next.js 15 (App Router) + Tailwind CSS 3 + TypeScript + Recharts + PostgreSQL (Supabase), pensada para Vercel.

## Qué incluye

- **Cuentas**: usuario y contraseña. Cada perfil vive en `https://tu-sitio/<usuario>` y se puede abrir desde cualquier dispositivo.
- **Dashboard** con selector de hijos (cambio rápido), anillos de crecimiento, próxima vacuna, último hito, última medición y curva compacta.
- **Crecimiento**: ficha de nacimiento, historial y gráfica interactiva de peso y talla con la mediana de referencia de la OMS (0–5 años).
- **Cartilla de vacunación** por rangos de edad: fecha, lote, lugar y recordatorio `.ics` de la siguiente dosis.
- **Hitos del desarrollo** por edad y área, con indicadores «dentro de lo esperado / vale la pena observar / conversa con tu pediatra».
- **Diario** de primeros logros, **con foto** (se reduce a ≤1600 px y JPEG antes de subirla).
- **Demo** sin cuenta en `/demo`: datos de ejemplo guardados solo en ese navegador (sin fotos).

Sistema de diseño «Naturaleza & Crecimiento»: `tailwind.config.ts`.

## Poner en marcha las cuentas (una sola vez)

La app necesita una base PostgreSQL. Con Supabase (gratis):

1. Crea un proyecto en https://supabase.com.
2. **SQL Editor → New query**, pega todo `supabase/setup.sql` y pulsa **Run** (crea las tablas y carga los catálogos de vacunas e hitos).
3. **Project Settings → Database → Connection string → Transaction pooler**: copia la URI y reemplaza `[YOUR-PASSWORD]` por la contraseña de la base.
4. En Vercel: **Settings → Environment Variables** → `DATABASE_URL` = esa URI (Production y Preview) → **Redeploy**.

Sin `DATABASE_URL` la app arranca igual: la portada avisa que las cuentas aún no están activas y `/demo` funciona.

## Cómo funciona

- **Contraseñas**: scrypt con sal por usuario; nunca se guardan en claro.
- **Sesión**: cookie `httpOnly` + `SameSite=Lax` con un token aleatorio; en la base solo se guarda su hash. Dura 30 días y se invalida al salir.
- **Privacidad**: el perfil `/<usuario>` solo se abre con la sesión de su dueño; otra cuenta ve un aviso, sin datos. Cada operación del servidor comprueba que la fila sea del usuario que la pide.
- **Protecciones**: máximo 10 fallos de login cada 15 min por usuario (30 por IP), 10 registros por hora por IP, comprobación de `Origin` (CSRF), validación de todos los datos con zod, fotos solo JPEG reales de ≤2,5 MB.
- **RLS**: todas las tablas tienen RLS activado y sin políticas, así que la API REST pública de Supabase no puede leer nada; la app accede solo desde el servidor con `DATABASE_URL`.
- **Sincronización**: los cambios se ven al instante y se envían en orden al servidor (`src/lib/store.tsx` → `/api/actions`). Si uno falla, se avisa y se recarga lo que sí quedó guardado. Al volver a la pestaña se traen los cambios hechos desde otro dispositivo.

## Ejecutar y probar en local

```bash
npm install
npm run dev            # http://localhost:3000  (/demo funciona sin base de datos)
npm test               # lógica de dominio y cuentas
npm run typecheck
npm run build
```

Pruebas de integración (necesitan una base de pruebas con `supabase/setup.sql` cargado):

```bash
DATABASE_URL=postgres://… npm run build && DATABASE_URL=postgres://… npm start -- -p 3100
BASE_URL=http://localhost:3100 npm run test:integration
```

Los catálogos son `src/data/vaccines.json` y `milestones.json`; `npm run db:seed` regenera `supabase/seed.sql` y `supabase/setup.sql`.

## Límites que conviene saber

- **No hay recuperación de contraseña**: las cuentas no piden correo. Si se olvida, no se puede restablecer. (Añadir correo opcional es el siguiente paso natural.)
- Las fotos se guardan en la propia base (~30–400 KB cada una). El plan gratuito de Supabase (500 MB) alcanza para miles; si crecen mucho, conviene moverlas a Supabase Storage.
- Las medianas de `src/lib/growth-reference.ts` son aproximadas (OMS 2006, 0–5 años): sustitúyelas por las tablas LMS oficiales antes de un uso clínico.
- El esquema de vacunas es una referencia basada en el calendario nacional de México; varía por país.
- Los hitos siguen la guía «Aprende los signos. Reacciona pronto» (CDC/AAP, 2022) hasta los 5 años; los de edades mayores son orientativos.
- La app orienta, no diagnostica.
