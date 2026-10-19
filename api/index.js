import { createApp } from "../server/src/app.js";
import {
  initializeDatabase,
  createDatabasePool,
  MySQLRepository,
  MemoryRepository,
} from "../server/src/db.js";
import { config } from "../server/src/config.js";

let appInstance = null;
let initPromise = null;

async function getApp() {
  if (appInstance) return appInstance;

  if (!initPromise) {
    initPromise = (async () => {
      let pool = null;
      let repository = null;

      if (config.isDbConfigured) {
        try {
          const db = await initializeDatabase(config.mysql);
          pool = db.pool;
          repository = db.repository;
          console.log("[Vercel API] MySQL connected and migrations verified.");
        } catch (err) {
          console.error(`[Vercel API Warning] MySQL init failed: ${err.message}. Retrying pool fallback...`);
          try {
            pool = createDatabasePool(config.mysql);
            repository = new MySQLRepository(pool);
          } catch (poolErr) {
            console.error(`[Vercel API Warning] Pool fallback failed: ${poolErr.message}. Running in-memory.`);
            repository = new MemoryRepository();
          }
        }
      } else {
        repository = new MemoryRepository();
      }

      appInstance = createApp({ repository, pool });
      return appInstance;
    })();
  }

  return initPromise;
}

export default async function handler(req, res) {
  const app = await getApp();
  return app(req, res);
}
