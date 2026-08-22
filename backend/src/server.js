const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./auth/routes');
const fileRoutes = require('./files/routes');
const sharingRoutes = require('./sharing/routes');
const securityRoutes = require('./security/routes');
const adminRoutes = require('./admin/routes');
const otpRoutes = require('./otp/routes');
const deviceRoutes = require('./devices/routes');


const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  hsts: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: true, // Allow requests from any network IP, domain, mobile device, or tunnel
  credentials: true,
}));

app.get('/favicon.ico', (req, res) => res.status(204).end());

// Rate limiting
const isLoadTesting = process.env.DISABLE_RATE_LIMIT === 'true' || process.env.NODE_ENV === 'test';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isLoadTesting ? 10000000 : 100,
  message: { success: false, message: 'Too many requests' },
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isLoadTesting ? 10000000 : 20,
  message: { success: false, message: 'Too many auth attempts' },
});
app.use('/api/auth/', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) },
}));

const os = require('os');

function getPrimaryIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'SecureVault API is running',
    lanIp: getPrimaryIp(),
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/share', sharingRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/devices', deviceRoutes);


// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server (listen on dual-stack IPv6/IPv4: Wi-Fi, Ethernet, LAN, Hotspot, localhost)
const PORT = config.port;
const HOST = process.env.HOST;

const serverCallback = () => {
  logger.info(`SecureVault API running on port ${PORT} (bound to all network interfaces)`);
  logger.info(`Environment: ${config.nodeEnv}`);
};

if (HOST) {
  app.listen(PORT, HOST, serverCallback);
} else {
  app.listen(PORT, serverCallback);
}

module.exports = app;
