import { NextResponse, type NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";

interface HealthCheckResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  database: {
    status: "connected" | "disconnected";
    responseTime?: number;
  };
  version: string;
}

// Track application start time
const appStartTime = Date.now();

export async function GET(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const checks: HealthCheckResponse = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: Math.round((Date.now() - appStartTime) / 1000),
    database: { status: "disconnected" },
    version: process.env.NEXT_PUBLIC_VERSION || "unknown",
  };

  try {
    // Check database connectivity
    const dbStartTime = Date.now();
    const { rows } = await pool.query("SELECT 1");
    const dbResponseTime = Date.now() - dbStartTime;

    checks.database = {
      status: rows.length === 1 ? "connected" : "disconnected",
      responseTime: dbResponseTime,
    };

    if (dbResponseTime > 5000) {
      checks.status = "degraded";
      logger.warn("health_check", "Database response time slow", {
        responseTimeMs: dbResponseTime,
      });
    }

    // Overall status
    if (checks.database.status === "disconnected") {
      checks.status = "unhealthy";
    }

    const responseTime = Date.now() - startTime;

    return NextResponse.json(checks, {
      status:
        checks.status === "healthy" ? 200 : checks.status === "degraded" ? 503 : 503,
    });
  } catch (err) {
    checks.status = "unhealthy";
    checks.database.status = "disconnected";

    logger.error("health_check_failed", err instanceof Error ? err.message : String(err));

    return NextResponse.json(checks, { status: 503 });
  }
}
