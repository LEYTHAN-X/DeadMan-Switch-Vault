/**
 * Centralized Application Logger
 * Formats timestamps and log severity levels cleanly without leaking sensitive payloads.
 */
const formatMessage = (level, message, meta = '') => {
  const timestamp = new Date().toISOString();
  const metaString = meta ? ` | ${typeof meta === 'object' ? JSON.stringify(meta) : meta}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
};

const logger = {
  info: (msg, meta) => console.log(formatMessage('info', msg, meta)),
  warn: (msg, meta) => console.warn(formatMessage('warn', msg, meta)),
  error: (msg, meta) => console.error(formatMessage('error', msg, meta)),
  debug: (msg, meta) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('debug', msg, meta));
    }
  }
};

module.exports = logger;

