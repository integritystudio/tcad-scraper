/**
 * k6 Load Test — TCAD API Endpoints
 *
 * Prerequisites:
 *   brew install k6   (macOS)
 *   or: https://grafana.com/docs/k6/latest/get-started/installation/
 *
 * Usage:
 *   # Smoke test (1 VU, 10s)
 *   k6 run --vus 1 --duration 10s load-tests/api.k6.js
 *
 *   # Light load (10 VUs, 30s)
 *   k6 run --vus 10 --duration 30s load-tests/api.k6.js
 *
 *   # Ramp test (stages defined below)
 *   k6 run load-tests/api.k6.js
 *
 *   # Against production
 *   BASE_URL=https://api.alephatx.info k6 run load-tests/api.k6.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";

// Custom metrics
const errorRate = new Rate("error_rate");
const healthLatency = new Trend("health_latency");
const statsLatency = new Trend("stats_latency");
const searchLatency = new Trend("search_latency");

export const options = {
  stages: [
    { duration: "10s", target: 5 },   // Ramp up to 5 VUs
    { duration: "30s", target: 10 },  // Hold at 10 VUs
    { duration: "10s", target: 0 },   // Ramp down
  ],
  thresholds: {
    // 95% of requests must complete under 2s
    http_req_duration: ["p(95)<2000"],
    // Error rate must stay below 5%
    error_rate: ["rate<0.05"],
    // Health endpoint must be fast
    health_latency: ["p(95)<200"],
  },
};

const SEARCH_TERMS = [
  "Oak Street",
  "Smith",
  "Johnson",
  "Williams",
  "Trust LLC",
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function () {
  // Health check
  const health = http.get(`${BASE_URL}/health`);
  healthLatency.add(health.timings.duration);
  check(health, {
    "health status 200": (r) => r.status === 200,
    "health body has status": (r) => r.json("status") === "healthy",
  }) || errorRate.add(1);

  sleep(0.2);

  // Property stats
  const stats = http.get(`${BASE_URL}/api/properties/stats`);
  statsLatency.add(stats.timings.duration);
  check(stats, {
    "stats status 2xx": (r) => r.status >= 200 && r.status < 300,
  }) || errorRate.add(1);

  sleep(0.2);

  // Property search (read-only, uses cached results when available)
  const term = randomItem(SEARCH_TERMS);
  const search = http.get(
    `${BASE_URL}/api/properties?search=${encodeURIComponent(term)}&limit=10`,
  );
  searchLatency.add(search.timings.duration);
  check(search, {
    "search status 2xx": (r) => r.status >= 200 && r.status < 300,
  }) || errorRate.add(1);

  sleep(0.5);
}
