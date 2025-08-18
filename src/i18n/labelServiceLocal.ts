/**
 * Service de gestion des labels multilingues - Version SQLite locale
 * Utilise la base de données SQLite locale au lieu de Supabase
 */

import { Sequelize, DataTypes, Model } from 'sequelize';
import * as path from 'path';

// Types
export type Lang = 'fr' | 'de' | 'en';
export type LabelType = 'zone' | 'constraint' | 'field' | 'message';

interface LabelAttributes {
  id?: number;
  code: string;
  type: LabelType;
  label_fr_short: string;
  label_fr_long?: string;
  label_de_short?: string;
  label_en_short?: string;
  severity?: number;
  category?: string;
}

// Connexion SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../data.db'),
  logging: false
});

// Modèle LabelDictionary
class LabelDictionary extends Model<LabelAttributes> implements LabelAttributes {
  public id!: number;
  public code!: string;
  public type!: LabelType;
  public label_fr_short!: string;
  public label_fr_long?: string;
  public label_de_short?: string;
  public label_en_short?: string;
  public severity?: number;
  public category?: string;
}

LabelDictionary.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('zone', 'constraint', 'field', 'message'),
    allowNull: false
  },
  label_fr_short: {
    type: DataTypes.STRING,
    allowNull: false
  },
  label_fr_long: {
    type: DataTypes.TEXT
  },
  label_de_short: {
    type: DataTypes.STRING
  },
  label_en_short: {
    type: DataTypes.STRING
  },
  severity: {
    type: DataTypes.INTEGER,
    validate: {
      min: 1,
      max: 3
    }
  },
  category: {
    type: DataTypes.STRING
  }
}, {
  sequelize,
  tableName: 'label_dictionary',
  underscored: true,
  timestamps: false
});

// Cache simple en mémoire
const labelCache = new Map<string, LabelAttributes>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let cacheTimestamp = 0;

/**
 * Récupère un label dans la langue demandée
 */
export async function getLabel(
  code: string,
  type: LabelType,
  lang: Lang = 'fr',
  long: boolean = false
): Promise<string> {
  try {
    const cacheKey = `${type}-${code}-${lang}-${long}`;
    
    // Vérifier le cache
    if (Date.now() - cacheTimestamp < CACHE_TTL && labelCache.has(cacheKey)) {
      const cached = labelCache.get(cacheKey)!;
      return extractLabel(cached, lang, long) || code;
    }
    
    // Chercher dans la BD
    const label = await LabelDictionary.findOne({
      where: { code, type }
    });
    
    if (!label) {
      console.log(`⚠️ Label non trouvé: ${type}/${code}`);
      return code;
    }
    
    // Mettre en cache
    labelCache.set(cacheKey, label.toJSON());
    cacheTimestamp = Date.now();
    
    return extractLabel(label.toJSON(), lang, long) || code;
    
  } catch (error) {
    console.error('Erreur getLabel:', error);
    return code;
  }
}

/**
 * Extrait le label dans la bonne langue avec fallback
 */
function extractLabel(label: LabelAttributes, lang: Lang, long: boolean): string | undefined {
  if (lang === 'fr') {
    return long && label.label_fr_long ? label.label_fr_long : label.label_fr_short;
  }
  
  const shortKey = `label_${lang}_short` as keyof LabelAttributes;
  const shortLabel = label[shortKey] as string | undefined;
  
  if (shortLabel) {
    return shortLabel;
  }
  
  // Fallback vers le français
  return long && label.label_fr_long ? label.label_fr_long : label.label_fr_short;
}

/**
 * Récupère la sévérité d'une contrainte
 */
export async function getSeverity(code: string): Promise<number | null> {
  try {
    const label = await LabelDictionary.findOne({
      where: { code, type: 'constraint' },
      attributes: ['severity']
    });
    
    return label?.severity || null;
  } catch (error) {
    console.error('Erreur getSeverity:', error);
    return null;
  }
}

/**
 * Récupère plusieurs labels d'un coup (optimisé)
 */
export async function getLabels(
  items: Array<{ code: string; type: LabelType }>,
  lang: Lang = 'fr',
  long: boolean = false
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  try {
    // Chercher tous les labels en une requête
    const labels = await LabelDictionary.findAll({
      where: {
        [Sequelize.Op.or]: items.map(item => ({
          code: item.code,
          type: item.type
        }))
      }
    });
    
    // Mapper les résultats
    for (const item of items) {
      const label = labels.find(l => l.code === item.code && l.type === item.type);
      if (label) {
        const text = extractLabel(label.toJSON(), lang, long) || item.code;
        results.set(`${item.type}-${item.code}`, text);
      } else {
        results.set(`${item.type}-${item.code}`, item.code);
      }
    }
    
  } catch (error) {
    console.error('Erreur getLabels:', error);
    // En cas d'erreur, retourner les codes
    for (const item of items) {
      results.set(`${item.type}-${item.code}`, item.code);
    }
  }
  
  return results;
}

/**
 * Précharge les labels communs au démarrage
 */
export async function preloadCommonLabels(): Promise<void> {
  try {
    const commonLabels = await LabelDictionary.findAll({
      where: {
        [Sequelize.Op.or]: [
          { type: 'zone' },
          { type: 'constraint', severity: { [Sequelize.Op.gte]: 2 } }
        ]
      }
    });
    
    console.log(`📚 ${commonLabels.length} labels communs préchargés`);
    
    // Mettre en cache
    for (const label of commonLabels) {
      const data = label.toJSON();
      for (const lang of ['fr', 'de', 'en'] as Lang[]) {
        for (const long of [true, false]) {
          const cacheKey = `${data.type}-${data.code}-${lang}-${long}`;
          labelCache.set(cacheKey, data);
        }
      }
    }
    
    cacheTimestamp = Date.now();
    
  } catch (error) {
    console.error('Erreur preloadCommonLabels:', error);
  }
}

// Initialiser la connexion au démarrage
sequelize.authenticate()
  .then(() => {
    console.log('✅ Connexion SQLite pour labels établie');
    return preloadCommonLabels();
  })
  .catch(err => {
    console.error('❌ Erreur connexion SQLite labels:', err);
  });