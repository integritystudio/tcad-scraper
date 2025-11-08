/**
 * Prometheus Metrics Middleware
 *
 * Automatically tracks HTTP request metrics
 */

import { Request, Response, NextFunction } from 'express';
import { recordHttpRequest } from '../lib/metrics.service';

/**
 * Extract route pattern from request
 * Converts /api/properties/123 to /api/properties/:id
 */
function getRoutePattern(req: Request): string {
  // If route is available, use it (Express 4.x)
  if (req.route?.path) {
    return req.baseUrl + req.route.path;
  }

  // Otherwise use the actual path
  return req.path;
}

/**
 * Metrics middleware
 * Records HTTP request metrics for all requests
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Capture the response finish event
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds
    const route = getRoutePattern(req);
    const method = req.method;
    const statusCode = res.statusCode;

    recordHttpRequest(method, route, statusCode, duration);
  });

  next();
}
