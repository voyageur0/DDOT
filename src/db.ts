// Base de données simplifiée pour l'instant
export const sql = {
  async query(text: string, params?: any[]) {
    console.log('DB Query:', text, params);
    return { rows: [], rowCount: 0 };
  }
}; 