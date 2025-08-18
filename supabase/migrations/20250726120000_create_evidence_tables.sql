-- Migration pour créer les tables de traçabilité et transparence
-- Permet de documenter l'origine et la fiabilité de chaque donnée

-- Catégories de fiabilité
create type reliability_level as enum ('direct', 'derived', 'estimated', 'missing');

-- Table générique de preuves (sources)
create table if not exists evidence_items (
  id uuid primary key default extensions.uuid_generate_v4(),
  ref_type text not null check (ref_type in ('regulation', 'context', 'calculation')),
  ref_id uuid,                                          -- ID de référence (regulations.id, context_layers.id, etc.)
  parcel_id text,                                      -- Parcelle concernée
  field text not null,                                 -- Champ concerné (indice_u, slope_pct, etc.)
  value_text text,                                     -- Valeur textuelle
  value_num numeric,                                   -- Valeur numérique
  value_json jsonb,                                    -- Valeur complexe
  reliability reliability_level not null,              -- Niveau de fiabilité
  source_path text,                                    -- Chemin vers la source (article, couche, formule)
  comment text,                                        -- Explication courte
  metadata jsonb,                                      -- Métadonnées additionnelles
  created_at timestamptz default now(),
  inserted_by text not null,                           -- Origine (ingest_script, buildCalculator, etc.)
  
  -- Contrainte d'unicité pour éviter les doublons
  constraint uniq_evidence unique (ref_type, ref_id, field, parcel_id)
);

-- Index pour recherches rapides
create index idx_evidence_parcel on evidence_items(parcel_id);
create index idx_evidence_ref on evidence_items(ref_type, ref_id);
create index idx_evidence_field on evidence_items(field);
create index idx_evidence_reliability on evidence_items(reliability);

-- Table de score global par analyse
create table if not exists analysis_quality (
  id uuid primary key default extensions.uuid_generate_v4(),
  parcel_id text not null,
  calc_date date not null default current_date,
  zone_id uuid,
  
  -- Scores de qualité
  score_global numeric not null check (score_global >= 0 and score_global <= 1),
  score_regulations numeric check (score_regulations >= 0 and score_regulations <= 1),
  score_context numeric check (score_context >= 0 and score_context <= 1),
  score_calculations numeric check (score_calculations >= 0 and score_calculations <= 1),
  
  -- Détails par champ
  details jsonb not null,                              -- {"indice_u": 0.95, "ibus": 0.75, ...}
  
  -- Statistiques
  total_fields integer default 0,
  direct_count integer default 0,
  derived_count integer default 0,
  estimated_count integer default 0,
  missing_count integer default 0,
  
  -- Métadonnées
  analysis_version text default '1.0',
  created_at timestamptz default now(),
  
  -- Contrainte d'unicité
  constraint uniq_analysis unique (parcel_id, calc_date)
);

-- Index pour recherches
create index idx_quality_parcel on analysis_quality(parcel_id);
create index idx_quality_date on analysis_quality(calc_date desc);
create index idx_quality_score on analysis_quality(score_global);

-- Vue utile pour dashboard qualité
create or replace view v_quality_summary as
select 
  calc_date,
  count(distinct parcel_id) as parcels_analyzed,
  avg(score_global) as avg_global_score,
  avg(score_regulations) as avg_regulations_score,
  avg(score_context) as avg_context_score,
  avg(score_calculations) as avg_calculations_score,
  sum(direct_count) as total_direct,
  sum(derived_count) as total_derived,
  sum(estimated_count) as total_estimated,
  sum(missing_count) as total_missing
from analysis_quality
group by calc_date
order by calc_date desc;

-- Vue détaillée des preuves par parcelle
create or replace view v_evidence_by_parcel as
select 
  e.parcel_id,
  e.field,
  e.value_text,
  e.value_num,
  e.reliability,
  e.source_path,
  e.comment,
  e.ref_type,
  case 
    when e.ref_type = 'regulation' then r.version
    when e.ref_type = 'context' then cl.layer_name
    else 'calculation'
  end as source_name,
  e.created_at
from evidence_items e
left join regulations r on e.ref_type = 'regulation' and e.ref_id = r.id
left join context_layers cl on e.ref_type = 'context' and e.ref_id = cl.id
order by e.parcel_id, e.reliability, e.field;

-- Row-Level Security : lecture publique
alter table evidence_items enable row level security;
alter table analysis_quality enable row level security;

-- Politique lecture publique
create policy "anon_read" on evidence_items 
  for select 
  using (true);

create policy "anon_read" on analysis_quality 
  for select 
  using (true);

-- Politique écriture service role uniquement
create policy "service_write" on evidence_items 
  for all 
  using (auth.role() = 'service_role');

create policy "service_write" on analysis_quality 
  for all 
  using (auth.role() = 'service_role');

-- Fonction helper pour calculer le score de fiabilité
create or replace function calculate_reliability_score(
  p_direct_count integer,
  p_derived_count integer,
  p_estimated_count integer,
  p_missing_count integer
) returns numeric as $$
declare
  total integer;
  score numeric;
begin
  total := p_direct_count + p_derived_count + p_estimated_count + p_missing_count;
  
  if total = 0 then
    return 0;
  end if;
  
  -- Pondération : direct=1.0, derived=0.8, estimated=0.5, missing=0
  score := (
    p_direct_count * 1.0 + 
    p_derived_count * 0.8 + 
    p_estimated_count * 0.5 + 
    p_missing_count * 0.0
  ) / total;
  
  return round(score, 3);
end;
$$ language plpgsql immutable;

-- Fonction pour insérer une preuve
create or replace function insert_evidence(
  p_ref_type text,
  p_ref_id uuid,
  p_parcel_id text,
  p_field text,
  p_value_text text default null,
  p_value_num numeric default null,
  p_value_json jsonb default null,
  p_reliability reliability_level default 'direct',
  p_source_path text default null,
  p_comment text default null,
  p_inserted_by text default 'system'
) returns uuid as $$
declare
  v_evidence_id uuid;
begin
  insert into evidence_items (
    ref_type, ref_id, parcel_id, field,
    value_text, value_num, value_json,
    reliability, source_path, comment, inserted_by
  ) values (
    p_ref_type, p_ref_id, p_parcel_id, p_field,
    p_value_text, p_value_num, p_value_json,
    p_reliability, p_source_path, p_comment, p_inserted_by
  )
  on conflict (ref_type, ref_id, field, parcel_id)
  do update set
    value_text = excluded.value_text,
    value_num = excluded.value_num,
    value_json = excluded.value_json,
    reliability = excluded.reliability,
    source_path = excluded.source_path,
    comment = excluded.comment,
    inserted_by = excluded.inserted_by,
    created_at = now()
  returning id into v_evidence_id;
  
  return v_evidence_id;
end;
$$ language plpgsql;

-- Trigger pour mettre à jour les compteurs dans analysis_quality
create or replace function update_quality_counters()
returns trigger as $$
begin
  -- Recalculer les compteurs pour la parcelle concernée
  update analysis_quality aq
  set 
    direct_count = (
      select count(*) from evidence_items 
      where parcel_id = new.parcel_id 
      and reliability = 'direct'
    ),
    derived_count = (
      select count(*) from evidence_items 
      where parcel_id = new.parcel_id 
      and reliability = 'derived'
    ),
    estimated_count = (
      select count(*) from evidence_items 
      where parcel_id = new.parcel_id 
      and reliability = 'estimated'
    ),
    missing_count = (
      select count(*) from evidence_items 
      where parcel_id = new.parcel_id 
      and reliability = 'missing'
    ),
    total_fields = (
      select count(*) from evidence_items 
      where parcel_id = new.parcel_id
    )
  where parcel_id = new.parcel_id
  and calc_date = current_date;
  
  return new;
end;
$$ language plpgsql;

create trigger update_quality_on_evidence
after insert or update on evidence_items
for each row
execute function update_quality_counters();

-- Commentaires pour documentation
comment on table evidence_items is 'Traçabilité de l''origine et fiabilité de chaque donnée utilisée';
comment on table analysis_quality is 'Score de qualité global par analyse de parcelle';
comment on type reliability_level is 'Niveau de fiabilité : direct (source), derived (calculé), estimated (estimé), missing (manquant)';
comment on column evidence_items.ref_type is 'Type de référence : regulation, context, calculation';
comment on column evidence_items.reliability is 'Niveau de fiabilité de la donnée';
comment on column analysis_quality.score_global is 'Score de qualité global 0-1 basé sur la fiabilité des données';
comment on column analysis_quality.details is 'Détail des scores par champ au format JSON';