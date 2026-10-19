-- Recuperación de contraseña por correo.
-- Es idempotente: se puede ejecutar más de una vez y sobre una base que ya tenía 0001.

-- Correo de la cuenta. Es obligatorio al registrarse (lo exige la app), pero la columna admite NULL
-- para las cuentas creadas antes de esta migración, que pueden añadirlo desde «Cuenta».
alter table public.users add column if not exists email text;

alter table public.users drop constraint if exists users_email_format;
alter table public.users add constraint users_email_format
  check (email is null or (email = lower(email) and char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));

create unique index if not exists users_email_key on public.users (email);

-- Enlaces de restablecimiento: se guarda solo el hash del token, caducan a la hora y se usan una vez.
create table if not exists public.password_resets (
  token_hash text primary key,
  user_id    uuid not null references public.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists password_resets_user_idx on public.password_resets (user_id);

-- Igual que el resto: RLS activado y sin políticas (solo accede el servidor).
alter table public.password_resets enable row level security;
