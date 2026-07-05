import "server-only";
import { logger } from "../logger";

interface RequestMetrics {
  totalRequests: number;
  errorCount: number;
  rateLimitCount: number;
  avgResponseTime: number;
  startTime: number;
}

interface MetricsWindow {
  [key: string]: RequestMetrics;
}

/**
 * In-memory request monitoring for detecting anomalies.
 * Tracks: request volume, error rates, rate limit triggers, response times.
 *
 * For production with multiple instances, use Prometheus + Grafana instead.
 */
class RequestMonitor {
  private currentWindow: MetricsWindow = {};
  private alertThresholds = {
    errorRatePercent: 50, // Alert if >50% requests error in a window
    rateLimitTriggersPerMin: 100, // Alert if >100 rate limits in a minute
  };

  recordRequest(
    endpoint: string,
    status: number,
    responseTimeMs: number,
    isRateLimited: boolean
  ): void {
    const metrics = this.currentWindow[endpoint] || {
      totalRequests: 0,
      errorCount: 0,
      rateLimitCount: 0,
      avgResponseTime: 0,
      startTime: Date.now(),
    };

    // Update metrics
    metrics.totalRequests += 1;
    if (status >= 400) metrics.errorCount += 1;
    if (isRateLimited) metrics.rateLimitCount += 1;

    // Update average response time (exponential moving average)
    metrics.avgResponseTime =
      metrics.avgResponseTime * 0.9 + responseTimeMs * 0.1;

    this.currentWindow[endpoint] = metrics;

    // Check thresholds
    this.checkAlerts(endpoint, metrics);
  }

  private checkAlerts(endpoint: string, metrics: RequestMetrics): void {
    const errorRate =
      metrics.totalRequests > 0
        ? (metrics.errorCount / metrics.totalRequests) * 100
        : 0;

    // Alert on high error rate
    if (
      metrics.totalRequests >= 10 &&
      errorRate > this.alertThresholds.errorRatePercent
    ) {
      logger.warn("monitoring", "High error rate detected", {
        endpoint,
        errorRate: errorRate.toFixed(1),
        requests: metrics.totalRequests,
        errors: metrics.errorCount,
      });
    }

    // Alert on high rate limit triggers
    const windowMinutes =
      (Date.now() - metrics.startTime) / 1000 / 60;
    const rateLimitsPerMin =
      metrics.rateLimitCount /
      (windowMinutes > 0 ? windowMinutes : 1);

    if (
      metrics.rateLimitCount > 10 &&
      rateLimitsPerMin > this.alertThresholds.rateLimitTriggersPerMin
    ) {
      logger.warn("monitoring", "High rate limit triggers detected", {
        endpoint,
        rateLimitsPerMin: rateLimitsPerMin.toFixed(1),
        totalTriggers: metrics.rateLimitCount,
      });
    }

    // Alert on slow endpoints (>1s avg)
    if (metrics.avgResponseTime > 1000) {
      logger.warn("monitoring", "Slow endpoint detected", {
        endpoint,
        avgResponseTimeMs: metrics.avgResponseTime.toFixed(0),
        requests: metrics.totalRequests,
      });
    }
  }

  /**
   * Get current metrics (for admin monitoring).
   */
  getMetrics(): MetricsWindow {
    return { ...this.currentWindow };
  }

  /**
   * Reset metrics window (call every 5 minutes).
   */
  resetWindow(): void {
    logger.debug("monitoring", "Metrics window reset");
    this.currentWindow = {};
  }
}

// Global monitor instance
const monitor = new RequestMonitor();

// Reset metrics window every 5 minutes
setInterval(() => monitor.resetWindow(), 5 * 60 * 1000);

export { monitor };

/**
 * Wrapper to easily record metrics around a handler.
 */
export async function monitorRequest<T>(
  endpoint: string,
  handler: () => Promise<{ status: number; isRateLimited?: boolean }>,
  context?: Record<string, unknown>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await handler();
    const responseTime = Date.now() - startTime;

    monitor.recordRequest(
      endpoint,
      result.status || 200,
      responseTime,
      result.isRateLimited || false
    );

    return result as T;
  } catch (err) {
    const responseTime = Date.now() - startTime;
    monitor.recordRequest(endpoint, 500, responseTime, false);
    throw err;
  }
}
