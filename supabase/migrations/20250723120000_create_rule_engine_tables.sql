-- Migration: Create rule engine tables for hierarchical rule resolution
-- Version: 20250723120000
-- Description: Moteur de règles hiérarchique pour gérer les conflits entre sources

-- Enum pour les niveaux de priorité des règles
create type rule_level as enum (
  'LEVEL1', -- Servitudes / PSQ (priorité maximale)
  'LEVEL2', -- Compléments d'aménagement communal
  'LEVEL3', -- RCCZ (Règlement communal)
  'LEVEL4'  -- Droit cantonal / fédéral (priorité minimale)
);

-- Table principale des définitions de règles
create table if not exists rule_definitions (
  id uuid primary key default uuid_generate_v4(),
  zone_id uuid references zones(id) on delete cascade,
  level rule_level not null,
  field text not null check (field ~ '^[a-z_]+$'), -- nom du champ (snake_case)
  value_num numeric, -- valeur numérique
  value_text text, -- valeur textuelle
  value_json jsonb, -- valeur complexe (ex: tableaux, objets)
  validity_from date default current_date,
  validity_to date,
  description text, -- description libre de la règle
  source_id uuid references regulation_sources(id),
  created_at timestamp with time zone default now(),
  
  -- Au moins une valeur doit être définie
  constraint check_has_value check (
    value_num is not null or 
    value_text is not null or 
    value_json is not null
  ),
  
  -- Contrainte de validité des dates
  constraint check_validity_dates check (
    validity_to is null or validity_to >= validity_from
  )
);

-- Index pour performances
create index idx_rule_definitions_zone_field_level 
  on rule_definitions (zone_id, field, level);

create index idx_rule_definitions_validity 
  on rule_definitions (validity_from, validity_to);

create index idx_rule_definitions_field 
  on rule_definitions (field);

-- Contrainte d'unicité pour éviter les doublons
create unique index idx_rule_definitions_unique 
  on rule_definitions (zone_id, field, level, validity_from) 
  where validity_to is null;

create unique index idx_rule_definitions_unique_with_end 
  on rule_definitions (zone_id, field, level, validity_from, validity_to) 
  where validity_to is not null;

-- Vue pour les règles actuellement valides
create or replace view v_active_rules as
select *
from rule_definitions
where current_date >= validity_from
  and (validity_to is null or current_date <= validity_to);

-- Fonction pour résoudre les règles par zone avec hiérarchie
create or replace function resolve_rules_by_zone(p_zone_id uuid)
returns table (
  field text,
  value_num numeric,
  value_text text,
  value_json jsonb,
  level rule_level,
  description text,
  overridden jsonb
) as $$
with all_rules as (
  -- Récupérer toutes les règles actives pour la zone
  select 
    r.field,
    r.value_num,
    r.value_text,
    r.value_json,
    r.level,
    r.description,
    -- Assigner un rang par priorité (LEVEL1 = 1, LEVEL2 = 2, etc.)
    row_number() over (
      partition by r.field 
      order by 
        case r.level 
          when 'LEVEL1' then 1
          when 'LEVEL2' then 2
          when 'LEVEL3' then 3
          when 'LEVEL4' then 4
        end
    ) as priority_rank
  from v_active_rules r
  where r.zone_id = p_zone_id
),
consolidated as (
  -- Règle principale (priorité 1)
  select 
    a1.field,
    a1.value_num,
    a1.value_text,
    a1.value_json,
    a1.level,
    a1.description,
    -- Agréger les règles écrasées
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'level', a2.level,
          'value_num', a2.value_num,
          'value_text', a2.value_text,
          'value_json', a2.value_json,
          'description', a2.description
        ) order by a2.priority_rank
      ) filter (where a2.priority_rank > 1),
      '[]'::jsonb
    ) as overridden
  from all_rules a1
  left join all_rules a2 on a1.field = a2.field and a2.priority_rank > 1
  where a1.priority_rank = 1
  group by a1.field, a1.value_num, a1.value_text, a1.value_json, a1.level, a1.description
)
select * from consolidated
order by field;
$$ language sql stable;

-- Fonction pour résoudre les règles par géométrie de parcelle
create or replace function resolve_rules_by_geom(p_geom_wkt text)
returns table (
  zone_id uuid,
  zone_code text,
  field text,
  value_num numeric,
  value_text text,
  value_json jsonb,
  level rule_level,
  description text,
  overridden jsonb
) as $$
begin
  return query
  with intersecting_zones as (
    -- Trouver toutes les zones qui intersectent la géométrie
    select z.id, z.code_norm
    from zones z
    where z.geom is not null
      and ST_Intersects(z.geom, ST_GeomFromText(p_geom_wkt, 2056))
  )
  select 
    iz.id as zone_id,
    iz.code_norm as zone_code,
    r.field,
    r.value_num,
    r.value_text,
    r.value_json,
    r.level,
    r.description,
    r.overridden
  from intersecting_zones iz
  cross join lateral resolve_rules_by_zone(iz.id) r
  order by iz.code_norm, r.field;
end;
$$ language plpgsql stable;

-- Row Level Security
alter table rule_definitions enable row level security;

-- Policy pour lecture publique
create policy "anon_read" on rule_definitions
  for select using (true);

-- Policy pour écriture (service role uniquement)
create policy "service_write" on rule_definitions
  for all using (auth.role() = 'service_role');

-- Fonction helper pour obtenir la valeur effective d'une règle
create or replace function get_rule_value(
  p_value_num numeric,
  p_value_text text,
  p_value_json jsonb
) returns text as $$
begin
  if p_value_num is not null then
    return p_value_num::text;
  elsif p_value_text is not null then
    return p_value_text;
  elsif p_value_json is not null then
    return p_value_json::text;
  else
    return null;
  end if;
end;
$$ language plpgsql immutable;

-- Commentaires
comment on table rule_definitions is 'Définitions de règles hiérarchiques pour le moteur de résolution';
comment on type rule_level is 'Niveaux de priorité: LEVEL1 (servitudes) > LEVEL2 (PAZ) > LEVEL3 (RCCZ) > LEVEL4 (cantonal/fédéral)';
comment on function resolve_rules_by_zone is 'Résout les règles pour une zone avec gestion de la hiérarchie et des conflits';
comment on function resolve_rules_by_geom is 'Résout les règles pour une géométrie de parcelle donnée';

-- Index pour améliorer les performances des jointures spatiales
create index if not exists idx_zones_geom_spatial on zones using gist(geom);