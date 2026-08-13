import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { existsSync } from "fs";
import { resolve } from "path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// In production, serve the built frontend SPA so the API and frontend can
// run as a single Railway service (no API_URL proxy config needed).
if (process.env.NODE_ENV === "production") {
  // __dirname is the built dist/ folder; frontend is two levels up then into bracket-golf/dist/public
  const frontendDist = resolve(__dirname, "../../bracket-golf/dist/public");
  if (existsSync(frontendDist)) {
    logger.info({ frontendDist }, "Serving frontend static files");
    // Long-cache for hashed assets, no-cache for the SPA shell
    app.use(express.static(frontendDist, { maxAge: "1y", index: false }));
    // SPA catch-all — everything not matched above returns index.html
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(resolve(frontendDist, "index.html"));
    });
  } else {
    logger.warn({ frontendDist }, "Frontend build not found — serving API only");
  }
}

export default app;
