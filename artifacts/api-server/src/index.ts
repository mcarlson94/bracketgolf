import app from "./app";
import { logger } from "./lib/logger";
import { importUSGAData } from "./lib/usga-importer";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Run initial import on startup
  importUSGAData("import")
    .then((log) => {
      logger.info(log, "Startup import complete");
    })
    .catch((err) => {
      logger.error({ err }, "Startup import failed");
    });

  // Auto-refresh USGA data every 10 minutes during tournament week
  // (Aug 10-16 2026). Outside that window this is a no-op.
  const TEN_MINUTES = 10 * 60 * 1000;
  setInterval(async () => {
    try {
      const now = new Date();
      const tournamentStart = new Date("2026-08-10T00:00:00-04:00");
      const tournamentEnd   = new Date("2026-08-17T00:00:00-04:00");
      if (now >= tournamentStart && now <= tournamentEnd) {
        const log = await importUSGAData("refresh");
        logger.info(log, "Auto-refresh complete");
      }
    } catch (err) {
      logger.warn({ err }, "Auto-refresh failed");
    }
  }, TEN_MINUTES);
});
