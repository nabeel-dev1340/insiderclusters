// Structured JSON-lines logger (Feature 1.6).
//
// Writes one JSON object per line to stdout. In production, systemd/Coolify
// captures stdout and can rotate it; keeping the app writing to stdout (rather
// than managing its own file rotation) is the twelve-factor-friendly default.

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const minLevel: Level = (process.env.LOG_LEVEL as Level) || "info";

function emit(level: Level, msg: string, fields?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields,
  };
  const out = JSON.stringify(line, (_k, v) =>
    typeof v === "bigint" ? v.toString() : v
  );
  if (level === "error" || level === "warn") process.stderr.write(out + "\n");
  else process.stdout.write(out + "\n");
}

export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit("debug", msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
};
