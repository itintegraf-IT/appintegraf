/**
 * Konfigurace připojení pro migraci z igvyroba do appintegraf.
 * Upravte podle vašeho prostředí – není potřeba měnit .env
 */
export default {
  /** Zdrojová databáze (PlanovaniVyroby / igvyroba) */
  source: {
    host: "localhost",
    port: 3306,
    user: "root",
    password: "mysql",
    database: "igvyroba",
  },

  /** Cílová databáze (APPIntegraf) */
  target: {
    host: "localhost",
    port: 3306,
    user: "root",
    password: "mysql",
    database: "appintegraf",
  },
};
