const jwt = require('jsonwebtoken');
const config = require('../config');
const response = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Verify JWT access token
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return response.error(res, 'Authentication required', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return response.error(res, 'Token expired', 401);
    }
    logger.warn('Authentication failed', { error: error.message });
    return response.error(res, 'Invalid token', 401);
  }
};

const scoreService = require('../security/scoreService');

/**
 * Role-based access control
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return response.error(res, 'Authentication required', 401);
    }
    if (!roles.includes(req.user.role)) {
      // Deduct score for unauthorized access attempt
      scoreService.decreaseSecurityScore(req.user.userId, 20, 'unauthorized_access_attempt')
        .catch((err) => logger.error('Failed to decrease security score for unauthorized access', { error: err.message }));
      return response.error(res, 'Insufficient permissions', 403);
    }
    next();
  };
};

/**
 * Generate access token
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiry });
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiry });
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwt.refreshSecret);
};

module.exports = {
  authenticate,
  authorize,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
};
