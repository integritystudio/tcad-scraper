/**
 * Client-side logger
 *
 * Simple wrapper around console for consistent logging in the browser
 * Can be enhanced later with remote logging, log levels, etc.
 */

const isDevelopment = import.meta.env.DEV;

const logger = {
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[INFO]', ...args);
    }
  },

  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  },

  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn('[WARN]', ...args);
    }
  },

  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug('[DEBUG]', ...args);
    }
  },

  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  }
};

export default logger;
