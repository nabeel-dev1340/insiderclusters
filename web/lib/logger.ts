import "server-only";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

function maskSensitiveData(text: string): string {
  let masked = text;

  // Mask common secrets and sensitive fields
  masked = masked.replace(/DATABASE_URL=[^\s]+/gi, "DATABASE_URL=***");
  masked = masked.replace(/api[_-]?key[=:]\s*[^\s,}]+/gi, "api_key=***");
  masked = masked.replace(/token[=:]\s*[^\s,}]+/gi, "token=***");
  masked = masked.replace(/password[=:]\s*[^\s,}]+/gi, "password=***");
  masked = masked.replace(/bearer\s+[^\s,}]+/gi, "bearer ***");
  masked = masked.replace(/authorization[=:]\s*[^\s,}]+/gi, "authorization=***");
  masked = masked.replace(/"(email|phone)":\s*"[^"]*"/gi, '"$1": "***"');

  return masked;
}

function formatLogMessage(
  level: LogLevel,
  component: string,
  message: string,
  context?: LogContext
): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";
  const logLine = `[${timestamp}] [${level.toUpperCase()}] [${component}] ${message}${contextStr}`;
  return maskSensitiveData(logLine);
}

export const logger = {
  debug: (component: string, message: string, context?: LogContext) => {
    if (process.env.DEBUG) {
      console.log(formatLogMessage("debug", component, message, context));
    }
  },

  info: (component: string, message: string, context?: LogContext) => {
    console.log(formatLogMessage("info", component, message, context));
  },

  warn: (component: string, message: string, context?: LogContext) => {
    console.warn(formatLogMessage("warn", component, message, context));
  },

  error: (component: string, message: string, context?: LogContext) => {
    console.error(formatLogMessage("error", component, message, context));
  },

  // Log security-relevant events
  security: (event: string, context?: LogContext) => {
    console.log(formatLogMessage("warn", "security", event, context));
  },
};
