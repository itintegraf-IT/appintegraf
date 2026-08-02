type Level = "debug" | "info" | "warn" | "error";

type Meta = Record<string, unknown> | Error;

function serializeError(err: Error): Record<string, unknown> {
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    cause: err.cause instanceof Error ? serializeError(err.cause) : err.cause,
  };
}

function hasStderr(): boolean {
  return typeof process !== "undefined" && typeof process.stderr?.write === "function";
}

function consoleFn(level: Level): (...args: unknown[]) => void {
  /* eslint-disable no-console */
  if (level === "error") return console.error;
  if (level === "warn") return console.warn;
  if (level === "info") return console.info;
  return console.debug;
  /* eslint-enable no-console */
}

function write(level: Level, msg: string, meta?: Meta): void {
  const isProd = process.env.NODE_ENV === "production";
  const timestamp = new Date().toISOString();

  if (isProd) {
    const payload: Record<string, unknown> = { time: timestamp, level, msg };
    if (meta instanceof Error) {
      payload.error = serializeError(meta);
    } else if (meta) {
      Object.assign(payload, meta);
    }
    const serialized = `${JSON.stringify(payload)}\n`;
    if (hasStderr()) process.stderr.write(serialized);
    else consoleFn(level)(serialized);
    return;
  }

  const color =
    level === "error" ? "\x1b[31m" : level === "warn" ? "\x1b[33m" : level === "info" ? "\x1b[36m" : "\x1b[90m";
  const reset = "\x1b[0m";
  const tag = `${color}[${level.toUpperCase()}]${reset}`;
  let line = `${timestamp} ${tag} ${msg}`;
  if (meta instanceof Error) {
    line += `\n  ${meta.stack ?? meta.message}`;
  } else if (meta) {
    line += ` ${JSON.stringify(meta)}`;
  }
  if (hasStderr()) process.stderr.write(`${line}\n`);
  else consoleFn(level)(line);
}

export const logger = {
  debug: (msg: string, meta?: Meta) => write("debug", msg, meta),
  info: (msg: string, meta?: Meta) => write("info", msg, meta),
  warn: (msg: string, meta?: Meta) => write("warn", msg, meta),
  error: (msg: string, meta?: Meta) => write("error", msg, meta),
};
