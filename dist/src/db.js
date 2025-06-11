"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sql = void 0;
// Base de données simplifiée pour l'instant
exports.sql = {
    async query(text, params) {
        console.log('DB Query:', text, params);
        return { rows: [], rowCount: 0 };
    }
};
