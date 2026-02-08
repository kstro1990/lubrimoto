// app/_lib/logger.ts
// Sistema de logging estructurado para LubriMotos ERP

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, any>;
  error?: Error;
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private isDevelopment: boolean;

  private constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private addLog(entry: LogEntry): void {
    this.logs.push(entry);
    
    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // In development, also log to console
    if (this.isDevelopment) {
      this.logToConsole(entry);
    }
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}]`;
    const context = entry.context ? ` [${entry.context}]` : '';
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(`${prefix}${context}:`, entry.message, entry.data || '');
        break;
      case LogLevel.INFO:
        console.info(`${prefix}${context}:`, entry.message, entry.data || '');
        break;
      case LogLevel.WARN:
        console.warn(`${prefix}${context}:`, entry.message, entry.data || '');
        break;
      case LogLevel.ERROR:
        console.error(`${prefix}${context}:`, entry.message, entry.data || '', entry.error || '');
        break;
    }
  }

  debug(message: string, context?: string, data?: Record<string, any>): void {
    this.addLog({
      timestamp: new Date(),
      level: LogLevel.DEBUG,
      message,
      context,
      data,
    });
  }

  info(message: string, context?: string, data?: Record<string, any>): void {
    this.addLog({
      timestamp: new Date(),
      level: LogLevel.INFO,
      message,
      context,
      data,
    });
  }

  warn(message: string, context?: string, data?: Record<string, any>): void {
    this.addLog({
      timestamp: new Date(),
      level: LogLevel.WARN,
      message,
      context,
      data,
    });
  }

  error(message: string, error?: Error, context?: string, data?: Record<string, any>): void {
    this.addLog({
      timestamp: new Date(),
      level: LogLevel.ERROR,
      message,
      context,
      data,
      error,
    });
  }

  // Get recent logs
  getRecentLogs(count: number = 100, level?: LogLevel): LogEntry[] {
    let filtered = this.logs;
    if (level) {
      filtered = this.logs.filter(log => log.level === level);
    }
    return filtered.slice(-count);
  }

  // Get all logs
  getAllLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Clear logs
  clearLogs(): void {
    this.logs = [];
  }

  // Export logs as JSON
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Download logs as file
  downloadLogs(): void {
    if (typeof window === 'undefined') return;

    const dataStr = this.exportLogs();
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `lubrimotos-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const logger = Logger.getInstance();

// Convenience exports
export const logDebug = (message: string, context?: string, data?: Record<string, any>) => 
  logger.debug(message, context, data);

export const logInfo = (message: string, context?: string, data?: Record<string, any>) => 
  logger.info(message, context, data);

export const logWarn = (message: string, context?: string, data?: Record<string, any>) => 
  logger.warn(message, context, data);

export const logError = (message: string, error?: Error, context?: string, data?: Record<string, any>) => 
  logger.error(message, error, context, data);

export default logger;
