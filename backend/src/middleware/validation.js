const { validationResult } = require('express-validator');
const response = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Express-validator middleware
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation failed details', { errors: errors.array(), body: req.body });
    return response.error(res, 'Validation failed', 400, errors.array());
  }
  next();
};

module.exports = { validate };
