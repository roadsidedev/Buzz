/**
 * Structured logging utility
 */

enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

interface LogContext {
  [key: string]: unknown;
}

/**
 * Logger with structured context
 */
class Logger {
  private level: LogLevel;

  constructor() {
    this.level = (process.env.LOG_LEVEL || "info") as LogLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
    ];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage(LogLevel.INFO, message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, context));
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  error(
    message: string,
    errorOrContext?: Error | unknown | LogContext,
    context?: LogContext,
  ): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      let errorContext: LogContext = {};

      if (errorOrContext) {
        if (
          errorOrContext instanceof Error ||
          typeof errorOrContext === "string"
        ) {
          // errorOrContext is an error
          errorContext = {
            ...context,
            error:
              errorOrContext instanceof Error
                ? errorOrContext.message
                : String(errorOrContext),
            stack:
              errorOrContext instanceof Error
                ? errorOrContext.stack
                : undefined,
          };
        } else {
          // errorOrContext is context
          errorContext = errorOrContext as LogContext;
        }
      }

      console.error(this.formatMessage(LogLevel.ERROR, message, errorContext));
    }
  }
}

export const logger = new Logger();

/**
 * @deprecated Use named export { logger } instead
 * Default export for backward compatibility
 */
export default logger;
