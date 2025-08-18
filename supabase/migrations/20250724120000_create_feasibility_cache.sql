-- Migration pour créer la table de cache des calculs de faisabilité
-- Stocke les résultats des calculs pour éviter les recalculs répétitifs

-- Table principale de cache
create table if not exists feasibility_cache (
  id uuid primary key default extensions.uuid_generate_v4(),
  parcel_id text not null,
  zone_id uuid not null references zones(id) on delete cascade,
  calc_date date not null default current_date,
  
  -- Métriques calculées
  su_m2 numeric,                  -- Surface utile (indice_u × surface)
  ibus_m2 numeric,                -- Surface brute (IBUS × surface)
  emprise_m2 numeric,             -- Emprise au sol maximale
  niveaux_max_est integer,        -- Nombre de niveaux estimé
  
  -- Qualité et contrôles
  reliability numeric check (reliability >= 0 and reliability <= 1), -- Score de fiabilité 0-1
  controls jsonb,                 -- Contrôles et avertissements
  
  -- Données sources
  consolidated_rules jsonb,       -- Règles consolidées utilisées pour le calcul
  
  -- Métadonnées
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Contrainte d'unicité pour éviter les doublons
  constraint unique_parcel_version unique (parcel_id, calc_date)
);

-- Index pour recherches rapides
create index idx_feasibility_cache_parcel on feasibility_cache(parcel_id);
create index idx_feasibility_cache_zone on feasibility_cache(zone_id);
create index idx_feasibility_cache_date on feasibility_cache(calc_date desc);

-- RLS pour lecture publique
alter table feasibility_cache enable row level security;

-- Politique de lecture publique
create policy "anon_read" on feasibility_cache 
  for select 
  using (true);

-- Politique d'écriture pour service role uniquement
create policy "service_write" on feasibility_cache 
  for all 
  using (auth.role() = 'service_role');

-- Trigger pour mise à jour automatique de updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_feasibility_cache_updated_at
  before update on feasibility_cache
  for each row
  execute function update_updated_at_column();

-- Fonction pour nettoyer les anciens caches (optionnel)
create or replace function clean_old_cache(days_to_keep integer default 30)
returns void as $$
begin
  delete from feasibility_cache
  where calc_date < current_date - interval '1 day' * days_to_keep;
end;
$$ language plpgsql;

-- Commentaires pour documentation
comment on table feasibility_cache is 'Cache des calculs de faisabilité pour optimiser les performances';
comment on column feasibility_cache.su_m2 is 'Surface utile calculée = indice_u × surface_parcelle';
comment on column feasibility_cache.ibus_m2 is 'Surface brute calculée = IBUS × surface_parcelle';
comment on column feasibility_cache.emprise_m2 is 'Emprise au sol maximale = emprise_max × surface_parcelle';
comment on column feasibility_cache.niveaux_max_est is 'Estimation du nombre de niveaux = floor(ibus_m2 / emprise_m2)';
comment on column feasibility_cache.reliability is 'Score de fiabilité des calculs (0-1), basé sur la complétude des données';
comment on column feasibility_cache.controls is 'Résultats des contrôles de cohérence au format JSON';
comment on column feasibility_cache.consolidated_rules is 'Snapshot des règles consolidées utilisées pour ce calcul';