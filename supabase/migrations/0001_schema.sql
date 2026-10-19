-- Crecer · esquema de datos (Supabase / PostgreSQL)
--
--   auth.users ──1:1── profiles ──1:N── children ──1:N── measurements
--                                          │  ├──N:M── vaccines   (vía child_vaccines)
--                                          │  ├──N:M── milestones (vía child_milestones)
--                                          │  └──1:N── journal_entries
--
-- `vaccines` y `milestones` son catálogos compartidos (solo lectura para la app, se cargan con supabase/seed.sql).
-- Todo lo demás pertenece a una persona adulta (profiles) y se protege con Row Level Security:
-- cada usuario solo ve y modifica a sus propios hijos y a los datos que cuelgan de ellos.

-- ---------------------------------------------------------------------------
-- Perfiles de adultos (1:1 con auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at   timestamptz not null default now()
);

-- Crea el perfil automáticamente cuando alguien se registra.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Hijos/as (multi-perfil: un adulto puede tener N)
-- ---------------------------------------------------------------------------
create table public.children (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 1 and 60),
  birth_date       date not null check (birth_date <= current_date),
  sex              text not null default 'unspecified' check (sex in ('female', 'male', 'unspecified')),
  tone             text not null default 'moss' check (tone in ('moss', 'sage', 'terracotta', 'sand')),
  blood_type       text not null default 'unknown'
                   check (blood_type in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown')),
  allergies        text[] not null default '{}',
  notes            text not null default '',
  -- Ficha de crecimiento inicial (datos de nacimiento)
  birth_weight_kg  numeric(5, 3) check (birth_weight_kg  between 0.3 and 10),
  birth_length_cm  numeric(4, 1) check (birth_length_cm  between 20 and 70),
  birth_head_cm    numeric(4, 1) check (birth_head_cm    between 15 and 50),
  created_at       timestamptz not null default now()
);

create index children_owner_idx on public.children (owner_id);

-- ---------------------------------------------------------------------------
-- Antropometría (historial de mediciones)
-- ---------------------------------------------------------------------------
create table public.measurements (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references public.children (id) on delete cascade,
  measured_at date not null,
  weight_kg   numeric(5, 2) check (weight_kg between 0.3 and 250),
  height_cm   numeric(5, 1) check (height_cm between 20 and 230),
  head_cm     numeric(4, 1) check (head_cm   between 15 and 70),
  note        text not null default '',
  source      text not null default 'manual' check (source in ('birth', 'manual')),
  created_at  timestamptz not null default now(),
  constraint measurements_has_value check (weight_kg is not null or height_cm is not null or head_cm is not null)
);

create index measurements_child_date_idx on public.measurements (child_id, measured_at);
-- Una sola medición "de nacimiento" por hijo/a: la mantiene el trigger de abajo.
create unique index measurements_one_birth_idx on public.measurements (child_id) where source = 'birth';

-- La ficha inicial de `children` es la fuente de verdad del primer punto de la curva.
create function public.sync_birth_measurement() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.birth_weight_kg is null and new.birth_length_cm is null and new.birth_head_cm is null then
    delete from public.measurements where child_id = new.id and source = 'birth';
  else
    insert into public.measurements (child_id, measured_at, weight_kg, height_cm, head_cm, source)
    values (new.id, new.birth_date, new.birth_weight_kg, new.birth_length_cm, new.birth_head_cm, 'birth')
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
  applied_at date not null check (applied_at <= current_date),
  lot        text not null default '',
  place      text not null default '',
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
  achieved_at  date not null check (achieved_at <= current_date),
  created_at   timestamptz not null default now(),
  primary key (child_id, milestone_id)
);

-- ---------------------------------------------------------------------------
-- Diario de primeros logros y recuerdos
-- ---------------------------------------------------------------------------
create table public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references public.children (id) on delete cascade,
  kind        text not null default 'otro'
              check (kind in ('sonrisa', 'volteo', 'palabra', 'pasos', 'diente', 'escuela', 'otro')),
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  occurred_at date not null check (occurred_at <= current_date),
  note        text not null default '',
  created_at  timestamptz not null default now()
);

create index journal_child_date_idx on public.journal_entries (child_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
create function public.owns_child(child uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.children c where c.id = child and c.owner_id = (select auth.uid()));
$$;

alter table public.profiles         enable row level security;
alter table public.children         enable row level security;
alter table public.measurements     enable row level security;
alter table public.child_vaccines   enable row level security;
alter table public.child_milestones enable row level security;
alter table public.journal_entries  enable row level security;
alter table public.vaccines         enable row level security;
alter table public.milestones       enable row level security;

create policy "profiles: solo el propio" on public.profiles
  for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "children: solo del dueño" on public.children
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "measurements: hijos propios" on public.measurements
  for all to authenticated
  using (public.owns_child(child_id)) with check (public.owns_child(child_id));

create policy "child_vaccines: hijos propios" on public.child_vaccines
  for all to authenticated
  using (public.owns_child(child_id)) with check (public.owns_child(child_id));

create policy "child_milestones: hijos propios" on public.child_milestones
  for all to authenticated
  using (public.owns_child(child_id)) with check (public.owns_child(child_id));

create policy "journal_entries: hijos propios" on public.journal_entries
  for all to authenticated
  using (public.owns_child(child_id)) with check (public.owns_child(child_id));

-- Catálogos: lectura para cualquier usuario autenticado; sin políticas de escritura
-- (solo se modifican con migraciones / service role).
create policy "vaccines: lectura"   on public.vaccines   for select to authenticated using (true);
create policy "milestones: lectura" on public.milestones for select to authenticated using (true);
