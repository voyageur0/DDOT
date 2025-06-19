import axios from 'axios';
import { searchParcel } from '../lib/geoAdmin';

/**
 * Récupère les informations propriétaires pour une parcelle
 */
export async function getOwners(commune: string, parcelNumber: string) {
  // 1. Trouver l'EGRID via geo.admin
  const searchResult = await searchParcel(`${commune} ${parcelNumber}`);
  if (!searchResult) {
    throw new Error('Parcelle introuvable');
  }
  const { egrid } = searchResult;
  console.log(`EGRID trouvé: ${egrid}`);

  // 2. Simuler la récupération des propriétaires (sans RDPPF)
  const owners = ['Propriétaire 1', 'Propriétaire 2']; // Données simulées
  
  return { egrid, owners };
}

// Exécution directe via « ts-node src/automation/parcelOwner.ts Anniviers 3333 »
if (require.main === module) {
  const [,, communeArg, parcelArg] = process.argv;
  if (!communeArg || !parcelArg) {
    console.error('Usage: ts-node src/automation/parcelOwner.ts <Commune> <NoParcelle>');
    process.exit(1);
  }
  getOwners(communeArg, parcelArg).then((result) => {
    console.log(`Propriétaires (${result.owners.length}):`);
    result.owners.forEach((o) => console.log(` - ${o}`));
  }).catch((err) => {
    console.error(err.message || err);
  });
} 