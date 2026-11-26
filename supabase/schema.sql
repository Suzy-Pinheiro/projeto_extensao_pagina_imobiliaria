-- Initial setup for a new Supabase project.
-- If an earlier version of this schema was already applied, do not rerun blindly;
-- create a migration for the existing tables first.
-- Configure the first administrator in Supabase Auth after creating the account:
-- Authentication > Users > select the user > edit raw_app_meta_data and set:
-- {"role":"admin"}
-- Sign out and back in afterward so the JWT receives the trusted app_metadata claim.
-- Never set this role from user_metadata or from client-side code.
-- Disable public sign-ups in Supabase Auth; create/authorize administrator accounts manually.

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(btrim(code)) between 3 and 30),
  finalidade text not null check (finalidade in ('comprar', 'alugar')),
  tipo text not null check (tipo in ('Apartamento', 'Casa', 'Terreno', 'Comercial')),
  titulo text not null check (length(btrim(titulo)) between 3 and 120),
  bairro text not null check (length(btrim(bairro)) between 2 and 100),
  preco numeric(14, 2) not null check (preco >= 0),
  quartos integer not null default 0 check (quartos >= 0),
  vagas integer not null default 0 check (vagas >= 0),
  area numeric(10, 2) not null check (area >= 0),
  status text not null default 'rascunho'
    check (status in ('disponivel', 'alugado', 'vendido', 'rascunho')),
  publicado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  storage_path text,
  external_url text,
  alt text not null default '',
  sort_order integer not null check (sort_order between 0 and 14),
  created_at timestamptz not null default now(),
  unique (property_id, sort_order),
  check ((storage_path is null) <> (external_url is null))
);

create index if not exists properties_public_listing_idx
  on public.properties (finalidade, created_at desc)
  where status = 'disponivel' and publicado = true;

create index if not exists property_images_property_idx
  on public.property_images (property_id, sort_order);

create or replace function public.set_property_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_property_updated_at() from public, anon, authenticated;

create or replace function public.enforce_property_image_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  image_count integer;
begin
  if tg_op = 'UPDATE' and new.property_id is distinct from old.property_id then
    raise exception 'A foto não pode ser movida para outro imóvel.';
  end if;

  perform 1
  from public.properties
  where id = new.property_id
  for update;

  if not found then
    raise exception 'O imóvel associado à foto não existe.';
  end if;

  select count(*)
  into image_count
  from public.property_images
  where property_id = new.property_id
    and id <> new.id;

  if image_count >= 15 then
    raise exception 'Cada imóvel pode ter no máximo 15 fotos.';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_property_image_limit() from public, anon, authenticated;

drop trigger if exists set_property_updated_at on public.properties;
create trigger set_property_updated_at
  before update on public.properties
  for each row execute function public.set_property_updated_at();

drop trigger if exists enforce_property_image_limit on public.property_images;
create trigger enforce_property_image_limit
  before insert or update on public.property_images
  for each row execute function public.enforce_property_image_limit();

alter table public.properties enable row level security;
alter table public.property_images enable row level security;

drop policy if exists "Public can read published available properties" on public.properties;
create policy "Public can read published available properties"
  on public.properties
  for select
  to anon, authenticated
  using (status = 'disponivel' and publicado = true);

drop policy if exists "Admins can read all properties" on public.properties;
create policy "Admins can read all properties"
  on public.properties
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can insert properties" on public.properties;
create policy "Admins can insert properties"
  on public.properties
  for insert
  to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update properties" on public.properties;
create policy "Admins can update properties"
  on public.properties
  for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can delete properties" on public.properties;
create policy "Admins can delete properties"
  on public.properties
  for delete
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Public can read photos of published available properties" on public.property_images;
create policy "Public can read photos of published available properties"
  on public.property_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.properties
      where id = property_images.property_id
        and status = 'disponivel'
        and publicado = true
    )
  );

drop policy if exists "Admins can read all property photos" on public.property_images;
create policy "Admins can read all property photos"
  on public.property_images
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can add property photos" on public.property_images;
create policy "Admins can add property photos"
  on public.property_images
  for insert
  to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update property photos" on public.property_images;
create policy "Admins can update property photos"
  on public.property_images
  for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can delete property photos" on public.property_images;
create policy "Admins can delete property photos"
  on public.property_images
  for delete
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select on public.properties to anon, authenticated;
grant insert, update, delete on public.properties to authenticated;
grant select on public.property_images to anon, authenticated;
grant insert, update, delete on public.property_images to authenticated;

insert into public.properties (
  code, finalidade, tipo, titulo, bairro, preco, quartos, vagas, area, status, publicado
)
values
  (
    'MNS-001', 'comprar', 'Apartamento',
    'Apartamento com varanda e vista livre', 'Adrianópolis',
    685000, 3, 2, 112, 'disponivel', true
  ),
  (
    'MNS-002', 'alugar', 'Apartamento',
    'Apartamento funcional perto de tudo', 'Parque 10 de Novembro',
    3200, 2, 1, 76, 'disponivel', true
  ),
  (
    'MNS-003', 'comprar', 'Casa',
    'Casa ampla com área de convivência', 'Ponta Negra',
    920000, 4, 3, 240, 'disponivel', true
  ),
  (
    'MNS-004', 'alugar', 'Comercial',
    'Sala comercial pronta para receber seu negócio', 'Nossa Senhora das Graças',
    2800, 0, 1, 58, 'disponivel', true
  )
on conflict (code) do nothing;

insert into public.property_images (property_id, external_url, alt, sort_order)
select id,
       'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1000&q=85',
       'Sala de apartamento contemporâneo com decoração clara',
       0
from public.properties
where code = 'MNS-001'
on conflict (property_id, sort_order) do nothing;

insert into public.property_images (property_id, external_url, alt, sort_order)
select id,
       'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=85',
       'Interior iluminado de apartamento com sala integrada',
       0
from public.properties
where code = 'MNS-002'
on conflict (property_id, sort_order) do nothing;

insert into public.property_images (property_id, external_url, alt, sort_order)
select id,
       'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=85',
       'Fachada de casa contemporânea com jardim',
       0
from public.properties
where code = 'MNS-003'
on conflict (property_id, sort_order) do nothing;

insert into public.property_images (property_id, external_url, alt, sort_order)
select id,
       'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=85',
       'Espaço comercial moderno com mesas e iluminação natural',
       0
from public.properties
where code = 'MNS-004'
on conflict (property_id, sort_order) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'imoveis-fotos',
  'imoveis-fotos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read images of published available properties" on storage.objects;
create policy "Public can read images of published available properties"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'imoveis-fotos'
    and (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      or exists (
        select 1
        from public.property_images
        join public.properties on properties.id = property_images.property_id
        where property_images.storage_path = storage.objects.name
          and properties.status = 'disponivel'
          and properties.publicado = true
      )
    )
  );

drop policy if exists "Admins can upload property images" on storage.objects;
create policy "Admins can upload property images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'imoveis-fotos'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Admins can update property images" on storage.objects;
create policy "Admins can update property images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'imoveis-fotos'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    bucket_id = 'imoveis-fotos'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Admins can delete property images" on storage.objects;
create policy "Admins can delete property images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'imoveis-fotos'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
