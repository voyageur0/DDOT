-- Migration: Add RPC function for point-based regulation search
-- Version: 20250722120001
-- Description: Fonction pour rechercher un règlement par coordonnées

-- Fonction pour rechercher un règlement à un point donné
create or replace function get_regulation_at_point(x_coord numeric, y_coord numeric)
returns table (
  id uuid,
  zone_id uuid,
  version date,
  indice_u numeric,
  ibus numeric,
  emprise_max numeric,
  h_max_m numeric,
  niveaux_max int,
  toit_types jsonb,
  pente_toit_min_max jsonb,
  recul_min_m numeric,
  remarques text,
  source_id uuid,
  is_active boolean,
  created_at timestamp with time zone,
  commune_id uuid,
  code_norm text,
  zone_label text,
  geom geometry,
  commune_name text,
  bfs_code int
) as $$
begin
  return query
  select 
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
  from zones z
  inner join regulations r on r.zone_id = z.id
  inner join communes c on c.id = z.commune_id
  where z.geom is not null
    and ST_Contains(z.geom, ST_SetSRID(ST_MakePoint(x_coord, y_coord), 2056))
    and r.is_active = true
  order by r.version desc
  limit 1;
end;
$$ language plpgsql stable;

-- Index spatial pour améliorer les performances
create index if not exists idx_zones_geom_spatial on zones using gist(geom);

-- Fonction générique pour rafraîchir n'importe quelle vue matérialisée
create or replace function refresh_materialized_view(view_name text)
returns void as $$
begin
  execute format('refresh materialized view concurrently %I', view_name);
exception
  when others then
    -- Si CONCURRENTLY échoue (pas d'index unique), essayer sans
    execute format('refresh materialized view %I', view_name);
end;
$$ language plpgsql security definer;

-- Commentaires
comment on function get_regulation_at_point is 'Recherche le règlement actif pour un point donné (coordonnées CH1903+ LV95)';
comment on function refresh_materialized_view is 'Rafraîchit une vue matérialisée de manière sécurisée';