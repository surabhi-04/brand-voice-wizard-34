import { validateEnvironment, config } from "./config.js";
import { createApp } from "./app.js";
import { initializeDatabase } from "./db.js";

// Validate environment variables at startup
const env = validateEnvironment();

async function start() {
  let repository = null;
  let pool = null;

  if (config.isDbConfigured) {
    try {
      console.log(
        `[Database] Connecting to MySQL at ${config.mysql.host}:${config.mysql.port}/${config.mysql.database}...`,
      );
      const db = await initializeDatabase(config.mysql);
      pool = db.pool;
      repository = db.repository;
      console.log(`[Database] Connected successfully to MySQL database "${config.mysql.database}".`);
      console.log(`[Database] Table migrations verified safely (users, campaigns).`);
    } catch (err) {
      console.error(
        `[Database Error] Failed to connect to MySQL database "${config.mysql.database}": ${err.message}`,
      );
      console.error(
        `[Database Error] To start MySQL on Windows: Open Services (services.msc) and start the MySQL service (e.g. MySQL80 or MySQL), or run in an elevated terminal: net start MySQL80`,
      );
      // Strictly avoid silent fallback to in-memory repository when MySQL is configured
      process.exit(1);
    }
  } else {
    console.warn(`[Database] MySQL credentials not configured. Running with in-memory repository.`);
  }

  const app = createApp({ repository, pool });

  const server = app.listen(env.port, () => {
    console.log(`[Brand Voice AI API] Server running at http://localhost:${env.port}`);
    console.log(
      `[Brand Voice AI API] Health check available at http://localhost:${env.port}/api/health`,
    );
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down gracefully...");
    server.close(async () => {
      if (pool) {
        try {
          await pool.end();
        } catch {
          // ignore pool close errors on shutdown
        }
      }
      console.log("Server closed.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
