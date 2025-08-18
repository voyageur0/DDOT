-- Migration: Create core regulation tables
-- Version: 20250722120000
-- Description: Modèle de données réglementaires unifié pour DDOT

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Enable PostGIS if not already enabled
create extension if not exists postgis;

-- Table des communes
create table if not exists communes (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  bfs_code int,
  created_at timestamp with time zone default now()
);

-- Index pour recherche rapide par nom
create index idx_communes_name on communes(name);
create index idx_communes_bfs_code on communes(bfs_code);

-- Table des zones
create table if not exists zones (
  id uuid primary key default uuid_generate_v4(),
  commune_id uuid references communes(id) on delete cascade,
  code_norm text not null,
  label text,
  geom geometry(MultiPolygon, 2056),
  created_at timestamp with time zone default now()
);

-- Index pour performances
create index idx_zones_commune_id on zones(commune_id);
create index idx_zones_code_norm on zones(code_norm);
create index idx_zones_geom on zones using gist(geom);

-- Contrainte d'unicité sur commune + code_norm
create unique index idx_zones_unique on zones(commune_id, code_norm);

-- Table des sources de règlements
create table if not exists regulation_sources (
  id uuid primary key default uuid_generate_v4(),
  pdf_path text not null,
  pdf_page int,
  article_ref text,
  ocr_confidence numeric check (ocr_confidence >= 0 and ocr_confidence <= 1),
  created_at timestamp with time zone default now()
);

-- Index pour retrouver rapidement une source
create index idx_regulation_sources_pdf on regulation_sources(pdf_path, pdf_page);

-- Table principale des règlements
create table if not exists regulations (
  id uuid primary key default uuid_generate_v4(),
  zone_id uuid references zones(id) on delete cascade,
  version date not null default current_date,
  indice_u numeric check (indice_u >= 0 and indice_u <= 10),
  ibus numeric check (ibus >= 0 and ibus <= 10),
  emprise_max numeric check (emprise_max >= 0 and emprise_max <= 1),
  h_max_m numeric check (h_max_m >= 0),
  niveaux_max int check (niveaux_max >= 0),
  toit_types jsonb,
  pente_toit_min_max jsonb check (
    pente_toit_min_max is null or (
      (pente_toit_min_max->>'min')::numeric >= 0 and
      (pente_toit_min_max->>'max')::numeric >= (pente_toit_min_max->>'min')::numeric
    )
  ),
  recul_min_m numeric check (recul_min_m >= 0),
  remarques text,
  source_id uuid references regulation_sources(id),
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  unique(zone_id, version)
);

-- Index pour performances
create index idx_regulations_zone_id on regulations(zone_id);
create index idx_regulations_version on regulations(version);
create index idx_regulations_active on regulations(is_active) where is_active = true;

-- Vue matérialisée pour les dernières versions actives
create materialized view v_regulations_latest as
select distinct on (zone_id)
  r.id,
  r.zone_id,
  r.version,
  r.indice_u,
  r.ibus,
  r.emprise_max,
  r.h_max_m,
  r.niveaux_max,
  r.toit_types,
  r.pente_toit_min_max,
  r.recul_min_m,
  r.remarques,
  r.source_id,
  r.is_active,
  r.created_at,
  z.commune_id,
  z.code_norm,
  z.label as zone_label,
  z.geom,
  c.name as commune_name,
  c.bfs_code
from regulations r
inner join zones z on z.id = r.zone_id
inner join communes c on c.id = z.commune_id
where r.is_active = true
order by zone_id, version desc;

-- Index sur la vue matérialisée
create unique index idx_v_regulations_latest_zone on v_regulations_latest(zone_id);
create index idx_v_regulations_latest_commune on v_regulations_latest(commune_id);

-- Function pour rafraîchir automatiquement la vue matérialisée
create or replace function refresh_regulations_latest()
returns trigger as $$
begin
  refresh materialized view concurrently v_regulations_latest;
  return null;
end;
$$ language plpgsql;

-- Trigger pour rafraîchir la vue après modifications
create trigger refresh_regulations_latest_trigger
after insert or update or delete on regulations
for each statement
execute function refresh_regulations_latest();

-- Row Level Security (RLS)
alter table communes enable row level security;
alter table zones enable row level security;
alter table regulations enable row level security;
alter table regulation_sources enable row level security;

-- Policies pour lecture publique (anon)
create policy "anon_read" on communes
  for select using (true);

create policy "anon_read" on zones
  for select using (true);

create policy "anon_read" on regulations
  for select using (true);

create policy "anon_read" on regulation_sources
  for select using (true);

-- Policies pour écriture (service role uniquement)
create policy "service_write" on communes
  for all using (auth.role() = 'service_role');

create policy "service_write" on zones
  for all using (auth.role() = 'service_role');

create policy "service_write" on regulations
  for all using (auth.role() = 'service_role');

create policy "service_write" on regulation_sources
  for all using (auth.role() = 'service_role');

-- Fonction helper pour désactiver les anciennes versions
create or replace function deactivate_old_regulations(p_zone_id uuid, p_version date)
returns void as $$
begin
  update regulations
  set is_active = false
  where zone_id = p_zone_id
    and version < p_version
    and is_active = true;
end;
$$ language plpgsql;

-- Commentaires sur les tables
comment on table communes is 'Communes du Valais avec leurs métadonnées';
comment on table zones is 'Zones d''affectation par commune avec géométries';
comment on table regulations is 'Règlements historisés par zone et version';
comment on table regulation_sources is 'Sources des données réglementaires (PDFs, OCR)';
comment on materialized view v_regulations_latest is 'Vue des dernières versions actives des règlements par zone';

-- Fonction pour obtenir les statistiques
create or replace function get_regulation_stats()
returns table (
  total_communes bigint,
  total_zones bigint,
  total_regulations bigint,
  active_regulations bigint,
  zones_with_geom bigint
) as $$
begin
  return query
  select
    (select count(*) from communes)::bigint as total_communes,
    (select count(*) from zones)::bigint as total_zones,
    (select count(*) from regulations)::bigint as total_regulations,
    (select count(*) from regulations where is_active = true)::bigint as active_regulations,
    (select count(*) from zones where geom is not null)::bigint as zones_with_geom;
end;
$$ language plpgsql;