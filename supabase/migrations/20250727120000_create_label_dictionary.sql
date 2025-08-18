-- Migration pour créer le dictionnaire de labels multilingue
-- Permet l'uniformisation et la traduction de tous les libellés

-- Table principale des labels
create table if not exists label_dictionary (
  id uuid primary key default extensions.uuid_generate_v4(),
  code text not null,                              -- Code technique (ex: 'R1', 'opb_noise_DS_III', 'pente_30_45')
  type text not null check (type in ('zone', 'constraint', 'field', 'message')), -- Type de label
  label_fr_short text not null,                    -- Label court français (≤12 mots)
  label_fr_long text,                              -- Label long français (optionnel)
  label_de_short text,                             -- Label court allemand
  label_de_long text,                              -- Label long allemand
  label_en_short text,                             -- Label court anglais
  label_en_long text,                              -- Label long anglais
  severity int check (severity >= 1 and severity <= 3), -- 1=INFO, 2=WARNING, 3=CRITICAL
  category text,                                   -- Catégorie optionnelle (ex: 'environnement', 'construction')
  metadata jsonb,                                  -- Métadonnées additionnelles
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Contrainte d'unicité
  constraint unique_label_code unique (type, code)
);

-- Index pour recherches rapides
create index idx_label_code on label_dictionary(code);
create index idx_label_type on label_dictionary(type);
create index idx_label_severity on label_dictionary(severity);

-- Trigger pour updated_at
create or replace function update_label_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_label_dictionary_updated_at
before update on label_dictionary
for each row
execute function update_label_updated_at();

-- Row Level Security : lecture publique
alter table label_dictionary enable row level security;

-- Politique lecture publique
create policy "anon_read" on label_dictionary 
  for select 
  using (true);

-- Politique écriture service role uniquement
create policy "service_write" on label_dictionary 
  for all 
  using (auth.role() = 'service_role');

-- Fonction helper pour récupérer un label
create or replace function get_label(
  p_code text,
  p_type text,
  p_lang text default 'fr',
  p_long boolean default false
) returns text as $$
declare
  v_column text;
  v_result text;
begin
  -- Construire le nom de colonne
  v_column := 'label_' || p_lang || '_' || case when p_long then 'long' else 'short' end;
  
  -- Requête dynamique
  execute format(
    'select %I from label_dictionary where code = $1 and type = $2',
    v_column
  ) into v_result using p_code, p_type;
  
  -- Si pas trouvé, essayer avec le label court français
  if v_result is null and p_lang != 'fr' then
    select label_fr_short into v_result
    from label_dictionary
    where code = p_code and type = p_type;
  end if;
  
  -- Fallback au code si toujours null
  return coalesce(v_result, p_code);
end;
$$ language plpgsql immutable;

-- Fonction pour récupérer la sévérité
create or replace function get_severity(
  p_code text,
  p_type text
) returns int as $$
  select coalesce(severity, 1)
  from label_dictionary
  where code = p_code and type = p_type;
$$ language sql immutable;

-- Vue pour les statistiques de traduction
create or replace view v_translation_coverage as
select 
  type,
  count(*) as total_labels,
  count(label_fr_short) as fr_short_count,
  count(label_fr_long) as fr_long_count,
  count(label_de_short) as de_short_count,
  count(label_en_short) as en_short_count,
  round(count(label_de_short)::numeric / count(*)::numeric * 100, 1) as de_coverage_pct,
  round(count(label_en_short)::numeric / count(*)::numeric * 100, 1) as en_coverage_pct
from label_dictionary
group by type
order by type;

-- Données initiales de base (zones principales)
insert into label_dictionary (code, type, label_fr_short, label_fr_long, severity) values
-- Zones d'habitation
('R1', 'zone', 'Hab. collectives', 'Zone d''habitations collectives (R1)', null),
('R2', 'zone', 'Hab. individuelles', 'Zone d''habitations individuelles (R2)', null),
('R3', 'zone', 'Hab. faible densité', 'Zone d''habitations de faible densité (R3)', null),
('R4', 'zone', 'Hab. très faible densité', 'Zone d''habitations de très faible densité (R4)', null),

-- Zones mixtes
('M1', 'zone', 'Mixte centre', 'Zone mixte centre-ville (M1)', null),
('M2', 'zone', 'Mixte périphérie', 'Zone mixte périphérique (M2)', null),

-- Zones commerciales/artisanales
('CA', 'zone', 'Commerce/artisanat', 'Zone commerciale et artisanale (CA)', null),
('I', 'zone', 'Industrielle', 'Zone industrielle (I)', null),

-- Zones spéciales
('ZP', 'zone', 'Zone protégée', 'Zone de protection du paysage', 2),
('ZV', 'zone', 'Zone verte', 'Zone verte et espaces libres', null),

-- Champs de règles
('indice_u', 'field', 'Indice U', 'Indice d''utilisation du sol', null),
('ibus', 'field', 'IBUS', 'Indice brut d''utilisation du sol', null),
('h_max_m', 'field', 'Hauteur max', 'Hauteur maximale en mètres', null),
('niveaux_max', 'field', 'Niveaux max', 'Nombre maximum de niveaux', null),
('emprise_max', 'field', 'Emprise max', 'Emprise au sol maximale', null),
('recul_min_m', 'field', 'Recul min', 'Distance de recul minimale', null),

-- Contraintes environnementales
('opb_noise_DS_I', 'constraint', 'Bruit DS I', 'Zone de bruit - Degré sensibilité I', 1),
('opb_noise_DS_II', 'constraint', 'Bruit DS II', 'Zone de bruit - Degré sensibilité II', 1),
('opb_noise_DS_III', 'constraint', 'Bruit DS III - Isolation', 'Zone de bruit DS III - Isolation acoustique requise', 2),
('opb_noise_DS_IV', 'constraint', 'Bruit DS IV - Critique', 'Zone de bruit DS IV - Construction très limitée', 3),

('ofac_airport', 'constraint', 'Zone aéroport OFAC', 'Zone de sécurité aéroportuaire (OFAC)', 2),

('risk_nat_faible', 'constraint', 'Danger naturel faible', 'Zone de danger naturel faible', 1),
('risk_nat_moyen', 'constraint', 'Danger moyen - Mesures', 'Zone de danger moyen - Mesures de protection requises', 2),
('risk_nat_fort', 'constraint', 'Danger fort - Interdit', 'Zone de danger fort - Construction interdite', 3),

('slope_0_15', 'constraint', 'Terrain plat', 'Terrain plat ou faible pente (0-15%)', 1),
('slope_15_30', 'constraint', 'Pente modérée', 'Pente modérée (15-30%)', 1),
('slope_30_45', 'constraint', 'Pente forte - Terrassements', 'Pente forte (30-45%) - Terrassements importants', 2),
('slope_45_plus', 'constraint', 'Pente très forte', 'Pente très forte (>45%) - Construction complexe', 3),

('roads_0_25m', 'constraint', 'Route < 25m - Recul', 'Proximité route cantonale - Recul obligatoire', 2),
('roads_25_100m', 'constraint', 'Route 25-100m', 'Route cantonale à proximité', 1)

on conflict (type, code) do nothing;

-- Commentaires
comment on table label_dictionary is 'Dictionnaire multilingue pour l''uniformisation des libellés';
comment on column label_dictionary.code is 'Code technique unique (ne change jamais)';
comment on column label_dictionary.type is 'Type de label : zone, constraint, field, message';
comment on column label_dictionary.severity is 'Niveau de criticité : 1=INFO, 2=WARNING, 3=CRITICAL';
comment on function get_label is 'Récupère un label dans la langue demandée avec fallback intelligent';
comment on function get_severity is 'Récupère le niveau de sévérité avec fallback à 1';