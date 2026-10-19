-- Crecer · esquema de datos (PostgreSQL; pensado para Supabase)
--
--   users ──1:N── sessions
--     └──1:N── children ──1:N── measurements
--                 │  ├──N:M── vaccines   (vía child_vaccines)
--                 │  ├──N:M── milestones (vía child_milestones)
--                 │  └──1:N── journal_entries ──1:1── journal_photos
--
-- Las cuentas (usuario + contraseña) las gestiona la propia app (src/server/auth.ts):
-- contraseñas con scrypt y sesiones con token aleatorio guardado como hash.
--
-- La app se conecta SIEMPRE desde el servidor (variable DATABASE_URL, rol postgres) y comprueba
-- que cada fila pertenezca a quien la pide. Como en Supabase las tablas de `public` también se
-- exponen por la API REST con la clave anónima, TODAS tienen RLS activado y ninguna política:
-- eso bloquea cualquier acceso por esa vía (el rol postgres del servidor se salta el RLS).
--
-- `vaccines` y `milestones` son catálogos compartidos (se cargan con seed.sql).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Cuentas y sesiones
-- ---------------------------------------------------------------------------
create table public.users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null check (username ~ '^[a-z0-9][a-z0-9_-]{2,29}$'),
  password_hash text not null,
  created_at    timestamptz not null default now()
);
create unique index users_username_key on public.users (username);

create table public.sessions (
  token_hash text primary key,                    -- sha256 del token que viaja en la cookie
  user_id    uuid not null references public.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_user_idx on public.sessions (user_id);
create index sessions_expires_idx on public.sessions (expires_at);

-- Eventos para limitar intentos (inicios de sesión fallidos, registros por IP).
create table public.rate_events (
  bucket text not null,
  at     timestamptz not null default now()
);
create index rate_events_bucket_idx on public.rate_events (bucket, at);

-- ---------------------------------------------------------------------------
-- Hijos/as (multi-perfil: una cuenta puede tener N)
-- ---------------------------------------------------------------------------
create table public.children (
  id               uuid primary key,              -- lo genera el cliente (permite guardar sin esperar)
  owner_id         uuid not null references public.users (id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 1 and 60),
  birth_date       date not null,
  sex              text not null default 'unspecified' check (sex in ('female', 'male', 'unspecified')),
  tone             text not null default 'moss' check (tone in ('moss', 'sage', 'terracotta', 'sand')),
  blood_type       text not null default 'unknown'
                   check (blood_type in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown')),
  allergies        text[] not null default '{}',
  notes            text not null default '' check (char_length(notes) <= 500),
  -- Ficha de crecimiento inicial (datos de nacimiento)
  birth_weight_kg  numeric(5, 3) check (birth_weight_kg between 0.3 and 10),
  birth_length_cm  numeric(4, 1) check (birth_length_cm between 20 and 70),
  birth_head_cm    numeric(4, 1) check (birth_head_cm   between 15 and 50),
  created_at       timestamptz not null default now()
);
create index children_owner_idx on public.children (owner_id);

-- ---------------------------------------------------------------------------
-- Antropometría (historial de mediciones)
-- ---------------------------------------------------------------------------
create table public.measurements (
  id          uuid primary key,
  child_id    uuid not null references public.children (id) on delete cascade,
  measured_at date not null,
  weight_kg   numeric(5, 2) check (weight_kg between 0.3 and 250),
  height_cm   numeric(5, 1) check (height_cm between 20 and 230),
  head_cm     numeric(4, 1) check (head_cm   between 15 and 70),
  note        text not null default '' check (char_length(note) <= 120),
  source      text not null default 'manual' check (source in ('birth', 'manual')),
  created_at  timestamptz not null default now(),
  constraint measurements_has_value check (weight_kg is not null or height_cm is not null or head_cm is not null)
);
create index measurements_child_date_idx on public.measurements (child_id, measured_at);
-- Una sola medición "de nacimiento" por hijo/a: la mantiene el trigger de abajo.
create unique index measurements_one_birth_idx on public.measurements (child_id) where source = 'birth';

-- La ficha inicial de `children` es la fuente de verdad del primer punto de la curva.
create function public.sync_birth_measurement() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.birth_weight_kg is null and new.birth_length_cm is null and new.birth_head_cm is null then
    delete from public.measurements where child_id = new.id and source = 'birth';
  else
    insert into public.measurements (id, child_id, measured_at, weight_kg, height_cm, head_cm, note, source)
    values (gen_random_uuid(), new.id, new.birth_date, new.birth_weight_kg, new.birth_length_cm, new.birth_head_cm,
            'Datos de nacimiento', 'birth')
    on conflict (child_id) where source = 'birth'
    do update set measured_at = excluded.measured_at,
                  weight_kg   = excluded.weight_kg,
                  height_cm   = excluded.height_cm,
                  head_cm     = excluded.head_cm;
  end if;
  return new;
end $$;

create trigger children_sync_birth_measurement
  after insert or update of birth_date, birth_weight_kg, birth_length_cm, birth_head_cm on public.children
  for each row execute function public.sync_birth_measurement();

-- ---------------------------------------------------------------------------
-- Vacunas: catálogo (esquema de referencia) + aplicaciones por hijo/a
-- ---------------------------------------------------------------------------
create table public.vaccines (
  id               text primary key,                 -- p. ej. 'hexa-2'
  series           text not null,                    -- agrupa dosis de una misma vacuna: 'hexa'
  name             text not null,
  dose             text not null,                    -- '2.ª dosis', 'Refuerzo'…
  protects_against text not null,
  due_month        smallint not null check (due_month >= 0),   -- edad recomendada, en meses
  group_id         text not null check (group_id in ('0-2m', '4m', '6m', '12-18m', 'escolar', 'adolescencia')),
  optional         boolean not null default false,   -- depende del esquema de cada país
  sort_order       smallint not null default 0
);

create table public.child_vaccines (
  child_id   uuid not null references public.children (id) on delete cascade,
  vaccine_id text not null references public.vaccines (id),
  applied_at date not null,
  lot        text not null default '' check (char_length(lot) <= 40),
  place      text not null default '' check (char_length(place) <= 60),
  created_at timestamptz not null default now(),
  primary key (child_id, vaccine_id)
);

-- ---------------------------------------------------------------------------
-- Hitos del desarrollo: catálogo + logros por hijo/a
-- ---------------------------------------------------------------------------
create table public.milestones (
  id     text primary key,                           -- p. ej. 'le-12-3'
  domain text not null check (domain in ('mg', 'mf', 'le', 'se', 'co')),
                                                     -- mg motricidad gruesa · mf fina · le lenguaje · se socioemocional · co cognitivo
  month  smallint not null check (month >= 0),       -- edad (meses) a la que se espera el hito
  text   text not null
);
create index milestones_month_idx on public.milestones (month, domain);

create table public.child_milestones (
  child_id     uuid not null references public.children (id) on delete cascade,
  milestone_id text not null references public.milestones (id),
  achieved_at  date not null,
  created_at   timestamptz not null default now(),
  primary key (child_id, milestone_id)
);

-- ---------------------------------------------------------------------------
-- Diario de primeros logros y recuerdos (con foto opcional)
-- ---------------------------------------------------------------------------
create table public.journal_entries (
  id          uuid primary key,
  child_id    uuid not null references public.children (id) on delete cascade,
  kind        text not null default 'otro'
              check (kind in ('sonrisa', 'volteo', 'palabra', 'pasos', 'diente', 'escuela', 'otro')),
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  occurred_at date not null,
  note        text not null default '' check (char_length(note) <= 600),
  created_at  timestamptz not null default now()
);
create index journal_child_date_idx on public.journal_entries (child_id, occurred_at desc);

-- La foto se guarda en la propia base (la app la reduce a ~300 KB antes de subirla).
-- Si algún día pesan demasiado, se pueden mover a Supabase Storage sin cambiar el resto.
create table public.journal_photos (
  entry_id   uuid primary key references public.journal_entries (id) on delete cascade,
  mime       text not null check (mime = 'image/jpeg'),
  data       bytea not null check (octet_length(data) between 1 and 2621440),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security: activado y SIN políticas = ningún acceso por la API REST pública.
-- ---------------------------------------------------------------------------
alter table public.users            enable row level security;
alter table public.sessions         enable row level security;
alter table public.rate_events      enable row level security;
alter table public.children         enable row level security;
alter table public.measurements     enable row level security;
alter table public.vaccines         enable row level security;
alter table public.child_vaccines   enable row level security;
alter table public.milestones       enable row level security;
alter table public.child_milestones enable row level security;
alter table public.journal_entries  enable row level security;
alter table public.journal_photos   enable row level security;
