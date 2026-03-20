type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

function writeLog(level: LogLevel, message: string, context?: LogContext) {
  const payload = context ? [message, context] : [message];

  switch (level) {
    case "debug":
      globalThis.console.debug(...payload);
      return;
    case "info":
      globalThis.console.info(...payload);
      return;
    case "warn":
      globalThis.console.warn(...payload);
      return;
    case "error":
      globalThis.console.error(...payload);
      return;
  }
}

export const logger = {
  debug(message: string, context?: LogContext) {
    writeLog("debug", message, context);
  },

  info(message: string, context?: LogContext) {
    writeLog("info", message, context);
  },

  warn(message: string, context?: LogContext) {
    writeLog("warn", message, context);
  },

  error(message: string, context?: LogContext) {
    writeLog("error", message, context);
  },
};