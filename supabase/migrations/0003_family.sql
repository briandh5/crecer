-- Familia: dos cuentas enlazadas ven y editan los perfiles de los hijos de ambas (p. ej. mamá y papá).
-- Es idempotente: se puede ejecutar más de una vez y sobre una base que ya tenía 0001 y 0002.

-- Un enlace por pareja de cuentas, guardado siempre con a < b para que no haya duplicados (A,B) y (B,A).
create table if not exists public.family_links (
  a          uuid not null references public.users (id) on delete cascade,
  b          uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
create index if not exists family_links_b_idx on public.family_links (b);

-- Invitaciones por correo: solo se guarda el hash del token, caducan a los 7 días y se usan una vez.
-- Solo las puede aceptar una cuenta con ese mismo correo.
create table if not exists public.family_invites (
  token_hash text primary key,
  inviter_id uuid not null references public.users (id) on delete cascade,
  email      text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists family_invites_inviter_idx on public.family_invites (inviter_id);

-- Igual que el resto: RLS activado y sin políticas (solo accede el servidor).
alter table public.family_links enable row level security;
alter table public.family_invites enable row level security;
