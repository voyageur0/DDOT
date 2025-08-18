-- Migration pour créer les tables de couches contextuelles
-- Stocke les données géospatiales externes pour enrichissement des analyses

-- Extension PostGIS requise
create extension if not exists postgis;

-- Table générique pour couches externes (bruit, aéroport, risques, etc.)
create table if not exists context_layers (
  id uuid primary key default extensions.uuid_generate_v4(),
  layer_name text not null unique,                     -- Identifiant unique de la couche
  layer_type text not null check (layer_type in ('vector', 'raster')), -- Type de données
  geom geometry(MultiPolygon, 2056),                  -- Géométrie vectorielle (LV95)
  raster_ref text,                                    -- Référence au raster si applicable
  metadata jsonb,                                     -- Métadonnées (source, date, attributs)
  source_url text,                                    -- URL source officielle
  last_updated date,                                  -- Date dernière mise à jour
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index spatial pour performances
create index idx_context_layers_geom on context_layers using gist(geom);
create index idx_context_layers_name on context_layers(layer_name);

-- Table de cache des résultats contextuels par parcelle
create table if not exists parcel_context (
  id uuid primary key default extensions.uuid_generate_v4(),
  parcel_id text not null,
  layer_id uuid not null references context_layers(id) on delete cascade,
  layer_name text not null,                           -- Dénormalisation pour performance
  intersects boolean not null default false,
  value_text text,                                    -- Valeur textuelle (ex: 'DS III')
  value_num numeric,                                  -- Valeur numérique (ex: 35 pour pente)
  distance_m numeric,                                 -- Distance en mètres si applicable
  severity integer check (severity between 1 and 3), -- 1=INFO, 2=WARNING, 3=CRITICAL
  message text,                                       -- Message formaté
  computed_at timestamptz default now(),
  
  -- Contrainte d'unicité pour éviter doublons
  constraint unique_parcel_layer unique (parcel_id, layer_id)
);

-- Index pour recherches rapides
create index idx_parcel_context_parcel on parcel_context(parcel_id);
create index idx_parcel_context_layer on parcel_context(layer_id);
create index idx_parcel_context_computed on parcel_context(computed_at);

-- RLS pour lecture publique
alter table context_layers enable row level security;
alter table parcel_context enable row level security;

-- Politique lecture publique
create policy "anon_read" on context_layers 
  for select 
  using (true);

create policy "anon_read" on parcel_context 
  for select 
  using (true);

-- Politique écriture service role uniquement
create policy "service_write" on context_layers 
  for all 
  using (auth.role() = 'service_role');

create policy "service_write" on parcel_context 
  for all 
  using (auth.role() = 'service_role');

-- Trigger mise à jour updated_at
create or replace function update_context_layers_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_context_layers_updated_at
  before update on context_layers
  for each row
  execute function update_context_layers_updated_at();

-- Fonction helper pour intersection parcelle/couche
create or replace function check_parcel_context(
  p_parcel_geom geometry,
  p_layer_name text
) returns table (
  intersects boolean,
  value_text text,
  value_num numeric,
  distance_m numeric
) as $$
declare
  v_layer record;
begin
  -- Récupérer la couche
  select * into v_layer
  from context_layers
  where layer_name = p_layer_name;
  
  if not found then
    return;
  end if;
  
  -- Vérifier l'intersection
  if v_layer.layer_type = 'vector' then
    -- Pour les couches vectorielles
    if st_intersects(p_parcel_geom, v_layer.geom) then
      return query
      select 
        true,
        v_layer.metadata->>'default_value' as value_text,
        (v_layer.metadata->>'default_num')::numeric as value_num,
        0::numeric as distance_m;
    else
      -- Calculer la distance si pas d'intersection
      return query
      select 
        false,
        null::text,
        null::numeric,
        st_distance(p_parcel_geom, v_layer.geom) as distance_m;
    end if;
  else
    -- Pour les couches raster (à implémenter selon besoins)
    return query
    select 
      false,
      null::text,
      null::numeric,
      null::numeric;
  end if;
end;
$$ language plpgsql;

-- Fonction de nettoyage des anciens caches
create or replace function clean_parcel_context_cache(days_to_keep integer default 30)
returns void as $$
begin
  delete from parcel_context
  where computed_at < now() - interval '1 day' * days_to_keep;
end;
$$ language plpgsql;

-- Vues utiles pour monitoring
create or replace view v_context_layer_stats as
select 
  cl.layer_name,
  cl.layer_type,
  cl.last_updated,
  count(distinct pc.parcel_id) as parcels_analyzed,
  avg(case when pc.intersects then 1 else 0 end) * 100 as intersection_rate_pct
from context_layers cl
left join parcel_context pc on cl.id = pc.layer_id
group by cl.id, cl.layer_name, cl.layer_type, cl.last_updated;

-- Commentaires pour documentation
comment on table context_layers is 'Couches de données contextuelles externes (bruit, risques, etc.)';
comment on table parcel_context is 'Cache des analyses contextuelles par parcelle';
comment on column context_layers.layer_name is 'Identifiant unique : opb_noise, ofac_airport, risk_nat, roads_cantonal, slope_pct';
comment on column parcel_context.severity is 'Niveau de sévérité : 1=INFO, 2=WARNING, 3=CRITICAL';
comment on column parcel_context.value_text is 'Valeur textuelle (ex: DS III pour degré de sensibilité au bruit)';
comment on column parcel_context.value_num is 'Valeur numérique (ex: 35 pour pente en %)';

-- Données initiales pour les types de couches attendus
insert into context_layers (layer_name, layer_type, metadata, source_url)
values 
  ('opb_noise', 'vector', '{"description": "Zones de bruit OPB", "categories": ["DS I", "DS II", "DS III", "DS IV", "DS V"]}'::jsonb, 'https://map.geo.admin.ch/'),
  ('ofac_airport', 'vector', '{"description": "Surfaces de dégagement aéroport", "airport": "Sion"}'::jsonb, 'https://www.bazl.admin.ch/'),
  ('risk_nat', 'vector', '{"description": "Dangers naturels", "types": ["crue", "glissement", "avalanche"]}'::jsonb, 'https://sitonline.vs.ch/'),
  ('roads_cantonal', 'vector', '{"description": "Routes cantonales", "buffer_m": 25}'::jsonb, 'https://sitonline.vs.ch/'),
  ('slope_pct', 'raster', '{"description": "Pente en pourcentage", "resolution_m": 2}'::jsonb, 'https://www.swisstopo.admin.ch/')
on conflict (layer_name) do nothing;