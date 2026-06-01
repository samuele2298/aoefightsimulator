'use strict';

const http = require('http');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const config = require('./config');
const logger = require('./logger');
const dataRoutes = require('./src/routes/dataRoutes');
const simulationRoutes = require('./src/routes/simulationRoutes');
const { registerWsHandlers } = require('./src/simulation/wsHandler');

const normalizePort = (val) => {
  const port = parseInt(val, 10);
  if (isNaN(port)) return val;
  if (port >= 0)   return port;
  return false;
};

const main = async () => {
  logger.info('Starting server on: ' + config.port);
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false, limit: '10mb' }));

  if (config.NODE_ENV === 'production') {
    app.use(cors({ origin: config.DOMAIN }));
    app.disable('x-powered-by');
    app.use(helmet({
      // Allow inline styles used by public/offer.html served statically
      contentSecurityPolicy: false,
    }));
  } else {
    app.use(cors());
  }

  // Trust reverse proxy (for rate limiting, IP detection)
  app.set('trust proxy', 1);

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${Date.now() - start}ms`);
    });
    next();
  });

  // Serve frontend static files
  app.use(express.static(path.join(__dirname, 'public')));

  // Serve aoe4data unit/building images locally
  app.use(
    '/data/images',
    express.static(path.join(__dirname, 'node_modules/aoe4data/images'))
  );

  // REST API routes
  app.use('/api/data', dataRoutes);
  app.use('/api/simulation', simulationRoutes);

  // Fallback: serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });


  // ── Boot ──────────────────────────────────────────────────────────────────────
  const port = normalizePort(config.port);
  const host = '0.0.0.0'; // Listen on all interfaces //If 'localhost' -> accepts only local connections
  const server = app.listen(port, host);

  const wss = new WebSocketServer({ server, path: '/ws' });
  registerWsHandlers(wss);


  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`[SHUTDOWN] ${signal} received. Closing server...`);
    try {
      server.close(async () => {
        await db.$pool.end();
        logger.info('[SHUTDOWN] Server closed.');
        process.exit(0);
      });
    } catch (err) {
      logger.error('[SHUTDOWN] Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

main();