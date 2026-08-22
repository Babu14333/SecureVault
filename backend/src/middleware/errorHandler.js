const logger = require('../utils/logger');
const response = require('../utils/response');

/**
 * Global error handler
 */
const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err.name === 'MulterError') {
    return response.error(res, `Upload error: ${err.message}`, 400);
  }

  if (err.name === 'ValidationError') {
    return response.error(res, err.message, 400);
  }

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  return response.error(res, message, statusCode);
};

/**
 * 404 handler
 */
const notFoundHandler = (req, res) => {
  return response.error(res, `Route ${req.method} ${req.path} not found`, 404);
};

module.exports = { errorHandler, notFoundHandler };
