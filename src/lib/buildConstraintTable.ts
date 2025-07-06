// Fusionne contraintes provenant du zoning, PLR et règlements en un tableau Markdown
import { RegulationConstraint } from './regulationExtractor';
import { PLRData } from './plrCadastre';

export interface ConstraintRow {
  theme: string;
  details: string;
}

const THEMES_ORDER = [
  'Identification',
  'Destination de zone',
  "Indice d'utilisation (IBUS)",
  'Gabarits & reculs',
  'Toiture',
  'Stationnement',
  'Espaces de jeux / détente',
  'Prescriptions architecturales'
] as const;

export function buildConstraintTable(
  communal: RegulationConstraint[],
  plr: PLRData | null,
  buildingZone: Record<string, any>
): string {
  const rows: ConstraintRow[] = [];

  // Indexer par thème pour consolidation
  const map: Record<string, string[]> = {};

  const pushConstraint = (theme: string, detail: string) => {
    if (!map[theme]) map[theme] = [];
    // S'assurer que detail est une string
    const detailStr = typeof detail === 'string' ? detail : String(detail);
    if (detailStr !== '[object Object]' && !map[theme].includes(detailStr)) {
      map[theme].push(detailStr);
    }
  };

  // 1. Contraintes communales
  for (const c of communal) pushConstraint(c.theme, `${c.zone !== '*' ? c.zone + ': ' : ''}${c.rule}`);

  // 2. PLR
  if (plr?.restrictions?.length) {
    for (const r of plr.restrictions) {
      pushConstraint('Destination de zone', (r as any).description || r.typeCode || '');
    }
  }

  // 3. Building zone (certaines valeurs)
  if (buildingZone?.ibus) pushConstraint("Indice d'utilisation (IBUS)", String(buildingZone.ibus));
  if (buildingZone?.hauteur_max) pushConstraint('Gabarits & reculs', `Hauteur max ${buildingZone.hauteur_max} m`);

  // Convertir en rows dans l'ordre fixe
  for (const theme of THEMES_ORDER) {
    const vals = map[theme];
    rows.push({ theme, details: vals?.join('; ') || 'Aucune donnée' });
  }

  // Générer Markdown
  let md = `| Thème | Points relevés |\n| --- | --- |\n`;
  for (const row of rows) {
    md += `| **${row.theme}** | ${row.details} |\n`;
  }
  return md;
} 