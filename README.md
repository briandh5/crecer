# Crecer — acompañamiento del desarrollo infantil

App n.º 3 del reto de 100 apps. Next.js 15 (App Router) + Tailwind CSS 3 + TypeScript + Recharts + PostgreSQL (Supabase), pensada para Vercel.

## Qué incluye

- **Cuentas**: usuario, correo y contraseña. Cada perfil vive en `https://tu-sitio/<usuario>` y se puede abrir desde cualquier dispositivo. Se entra con el usuario o con el correo.
- **Recuperación de contraseña** por correo y página **Mi cuenta** (cambiar correo y contraseña).
- **Dashboard** con selector de hijos (cambio rápido), anillos de crecimiento, próxima vacuna, último hito, última medición y curva compacta.
- **Crecimiento**: ficha de nacimiento, historial y gráfica interactiva de peso y talla con la mediana de referencia de la OMS (0–5 años).
- **Cartilla de vacunación** por rangos de edad: fecha, lote, lugar y recordatorio `.ics` de la siguiente dosis.
- **Hitos del desarrollo** por edad y área, con indicadores «dentro de lo esperado / vale la pena observar / conversa con tu pediatra».
- **Diario** de primeros logros, **con foto** (se reduce a ≤1600 px y JPEG antes de subirla).
- **Demo** sin cuenta en `/demo`: datos de ejemplo guardados solo en ese navegador (sin fotos).

Sistema de diseño «Naturaleza & Crecimiento»: `tailwind.config.ts`.

## Poner en marcha las cuentas (una sola vez)

La app necesita una base PostgreSQL y, para recuperar contraseñas, una cuenta de correo SMTP.

**1. Base de datos (Supabase, gratis)**

1. Crea un proyecto en https://supabase.com.
2. **SQL Editor → New query**, pega todo `supabase/setup.sql` y pulsa **Run** (tablas + catálogos de vacunas e hitos).
   - ¿Ya habías ejecutado una versión anterior? Ejecuta solo `supabase/migrations/0002_email_recovery.sql` (es idempotente).
3. Botón **Connect** → **Transaction pooler** (puerto 6543). Copia la URI y reemplaza `[YOUR-PASSWORD]`.
   **No uses «Direct connection»** (`db.xxxx.supabase.co:5432`): solo funciona por IPv6 y Vercel no puede conectarse.

**2. Correo (para «¿Olvidaste tu contraseña?»)**

Sirve cualquier SMTP. Con Gmail: activa la verificación en dos pasos y crea una *contraseña de aplicación* en https://myaccount.google.com/apppasswords (16 letras; no es tu contraseña normal). Gmail permite unos 500 envíos al día; para más volumen o mejor entrega usa Brevo, Resend u otro.

**3. Variables en Vercel** (*Settings → Environment Variables*, en Production y Preview) y luego **Redeploy**:

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | la URI del *Transaction pooler* |
| `APP_URL` | `https://crecer-two.vercel.app` (la dirección pública; los enlaces de los correos se arman con ella) |
| `SMTP_HOST` / `SMTP_PORT` | `smtp.gmail.com` / `465` |
| `SMTP_USER` / `SMTP_PASS` | tu correo y la contraseña de aplicación |
| `MAIL_FROM` | opcional, p. ej. `Crecer <tu-cuenta@gmail.com>` |

**Comprobar que todo quedó bien:** abre `https://tu-sitio/api/health`. Debe decir `"ok": true`; si no, el campo `hint` indica qué falta (variable, migración, conexión). No muestra secretos.

Sin `DATABASE_URL` la app arranca igual: la portada avisa que las cuentas aún no están activas y `/demo` funciona. Sin `SMTP_HOST`, las cuentas funcionan pero «Olvidaste tu contraseña» avisa que no está activado.

## Cómo funciona

- **Contraseñas**: scrypt con sal por usuario; nunca se guardan en claro.
- **Sesión**: cookie `httpOnly` + `SameSite=Lax` con un token aleatorio; en la base solo se guarda su hash. Dura 30 días y se invalida al salir.
- **Privacidad**: el perfil `/<usuario>` solo se abre con la sesión de su dueño; otra cuenta ve un aviso, sin datos. Cada operación del servidor comprueba que la fila sea del usuario que la pide.
- **Recuperación**: el enlace llega al correo de la cuenta, vale 60 minutos, se usa una sola vez (en la base solo se guarda su hash), anula los enlaces anteriores y, al usarse, cierra las sesiones abiertas. La respuesta es idéntica exista o no la cuenta (no revela quién está registrado). Máximo 3 correos por hora y cuenta y 5 solicitudes por hora y IP.
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
DATABASE_URL=postgres://… npm run build
DATABASE_URL=postgres://… SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_SECURE=false APP_URL=http://localhost:3100 npm start -- -p 3100
DATABASE_URL=postgres://… BASE_URL=http://localhost:3100 npm run test:integration   # levanta su propio SMTP falso en el puerto 2525
```

Los catálogos son `src/data/vaccines.json` y `milestones.json`; `npm run db:seed` regenera `supabase/seed.sql` y `supabase/setup.sql`.

## Límites que conviene saber

- **El correo no se verifica**: se pide al registrarse, pero no se confirma con un enlace. Si alguien se equivoca al escribirlo, no recibirá el enlace de recuperación (puede corregirlo en *Mi cuenta* mientras tenga sesión).
- Las cuentas creadas sin correo (anteriores a la migración 0002) pueden agregarlo en *Mi cuenta*.
- Las fotos se guardan en la propia base (~30–400 KB cada una). El plan gratuito de Supabase (500 MB) alcanza para miles; si crecen mucho, conviene moverlas a Supabase Storage.
- Las medianas de `src/lib/growth-reference.ts` son aproximadas (OMS 2006, 0–5 años): sustitúyelas por las tablas LMS oficiales antes de un uso clínico.
- El esquema de vacunas es una referencia basada en el calendario nacional de México; varía por país.
- Los hitos siguen la guía «Aprende los signos. Reacciona pronto» (CDC/AAP, 2022) hasta los 5 años; los de edades mayores son orientativos.
- La app orienta, no diagnostica.
