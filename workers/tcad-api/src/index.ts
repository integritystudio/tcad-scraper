/**
 * TCAD API Worker — Hono app entry point.
 * Replaces server/src/index.ts (Express).
 */

import * as Sentry from "@sentry/cloudflare";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { AppEnv, Env } from "./bindings";
import { apiUsageRoutes } from "./controllers/api-usage";
import { propertyRoutes } from "./controllers/property";
import { createPrisma } from "./db";
import { getErrorMessage } from "./utils/error-helpers";

const app = new Hono<AppEnv>();

// ── Global middleware ──────────────────────────────────────────────

app.use("*", cors({
  origin: (origin) => {
    const allowed = [
      "https://alephatx.info",
      "https://www.alephatx.info",
      "http://localhost:5173",
      "http://localhost:5174",
    ];
    // Allow requests with no Origin header (curl, mobile apps)
    if (!origin) return "*";
    return allowed.includes(origin) ? origin : "";
  },
  credentials: true,
}));

app.use("*", secureHeaders());

// Attach per-request Prisma client via D1
app.use("*", async (c, next) => {
  const prisma = createPrisma(c.env.DB);
  c.set("prisma", prisma);
  await next();
  // D1 connections are stateless per-request; no explicit disconnect needed.
});

// ── Health check ───────────────────────────────────────────────────

app.get("/health", async (c) => {
  const prisma = c.get("prisma");
  try {
    const count = await prisma.property.count();
    return c.json({ status: "ok", propertyCount: count, runtime: "cloudflare-workers" });
  } catch (err) {
    return c.json({ status: "error", error: getErrorMessage(err) }, 503);
  }
});

// ── Routes ─────────────────────────────────────────────────────────

app.route("/api/properties", propertyRoutes);
app.route("/api/usage", apiUsageRoutes);

// ── Error handler ──────────────────────────────────────────────────

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  Sentry.captureException(err);
  return c.json({ error: "Internal server error" }, 500);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

// ── Queue consumer (Phase 2) ──────────────────────────────────────

interface ScrapeMessage {
  searchTerm: string;
  year: number;
}

const worker = {
  fetch: app.fetch,

  async queue(batch: MessageBatch, env: Env) {
    for (const msg of batch.messages) {
      try {
        await env.SCRAPER_WORKFLOW.create({
          params: msg.body as ScrapeMessage,
        });
        msg.ack();
      } catch (err) {
        console.error("Failed to create workflow:", err);
        msg.retry();
      }
    }
  },

  async scheduled(controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
    switch (controller.cron) {
      case "*/4 * * * *":
        return refreshToken(env);
      case "0 * * * *":
        return cleanupStaleJobs(env);
      case "0 3 * * *":
        // Search term optimization — placeholder for future implementation
        console.log("Search term optimization cron fired");
        return;
      case "0 */6 * * *":
        return runMonitoredSearches(env);
      default:
        console.warn(`Unknown cron: ${controller.cron}`);
    }
  },
};

// ── Cron handlers ─────────────────────────────────────────────────

async function refreshToken(env: Env): Promise<void> {
  try {
    const res = await fetch(env.TOKEN_WORKER_URL, {
      headers: { Authorization: `Bearer ${env.TOKEN_WORKER_SECRET}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`Token refresh failed: ${res.status}`);
      return;
    }
    const { token, expiresIn } = (await res.json()) as { token: string; expiresIn: number };
    await env.TOKEN_CACHE.put("tcad-token", token, { expirationTtl: expiresIn - 30 });
    console.log("Token refreshed and cached in KV");
  } catch (err) {
    console.error("Token refresh error:", err);
  }
}

async function cleanupStaleJobs(env: Env): Promise<void> {
  try {
    const prisma = createPrisma(env.DB);
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await prisma.scrapeJob.updateMany({
      where: { status: "processing", startedAt: { lt: cutoff.toISOString() } },
      data: { status: "failed", error: "Stale job cleaned up", completedAt: new Date().toISOString() },
    });
    if (result.count > 0) console.log(`Cleaned ${result.count} stale jobs`);
  } catch (err) {
    console.error("Stale job cleanup error:", err);
  }
}

async function runMonitoredSearches(env: Env): Promise<void> {
  try {
    const prisma = createPrisma(env.DB);
    const searches = await prisma.monitoredSearch.findMany({ where: { active: true } });
    const year = parseInt(env.TCAD_YEAR, 10) || 2025;

    for (const search of searches) {
      await env.SCRAPER_QUEUE.send({ searchTerm: search.searchTerm, year });
      const now = new Date().toISOString();
      await prisma.monitoredSearch.update({
        where: { id: search.id },
        data: { lastRun: now, updatedAt: now },
      });
    }
    console.log(`Enqueued ${searches.length} monitored searches`);
  } catch (err) {
    console.error("Monitored search error:", err);
  }
}

// ── Export with Sentry wrapping ────────────────────────────────────

export { ScraperWorkflow } from "./workflows/scraper.workflow";

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  }),
  worker,
);
