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
const { sendServerError } = require('./src/tg');

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

  // Serve frontend static files; disable cache only for HTML documents.
  app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
      if (path.extname(filePath) === '.html') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    },
  }));

  // Serve aoe4data unit/building images locally
  app.use(
    '/data/images',
    express.static(path.join(__dirname, 'node_modules/aoe4data/images'))
  );

  // REST API routes
  app.use('/api/data', dataRoutes);
  app.use('/api/simulation', simulationRoutes);

  // Global error middleware: catches errors propagated via next(err).
  app.use((err, req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress;
    const where = `${req.method} ${req.originalUrl}`;
    logger.error(err, `Unhandled HTTP error on ${where}`);
    sendServerError({
      type: 'http',
      where,
      ip,
      error: err && err.message ? err.message : 'Unhandled HTTP error',
      details: err && err.stack ? err.stack : 'no stack',
    });

    if (res.headersSent) {
      return next(err);
    }

    const status = Number(err && err.status) || 500;
    if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
      return res.status(status).json({ error: err.message || 'Internal server error' });
    }
    return res.status(status).send('Internal server error');
  });

  // Fallback: serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });


  // ── Boot ──────────────────────────────────────────────────────────────────────
  const port = normalizePort(config.port);
  const host = '0.0.0.0'; // Listen on all interfaces //Se 'localhost' -> accetta solo connessioni locali'
  const server = app.listen(port, host);
  server.on('error', (err) => {
    logger.error(err, 'HTTP server error');
    sendServerError({
      type: 'http-server',
      where: 'server.listen',
      error: err && err.message ? err.message : 'HTTP server error',
      details: err && err.stack ? err.stack : 'no stack',
    });
  });

  const wss = new WebSocketServer({ server, path: '/ws' });
  registerWsHandlers(wss);


  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`[SHUTDOWN] ${signal} received. Closing server...`);
    try {
      server.close(() => {
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

  process.on('unhandledRejection', (reason) => {
    const details = reason && reason.stack ? reason.stack : JSON.stringify(reason);
    logger.error(details, 'Unhandled promise rejection');
    sendServerError({
      type: 'unhandledRejection',
      where: 'process',
      error: reason && reason.message ? reason.message : String(reason),
      details,
    });
  });

  process.on('uncaughtException', (err) => {
    logger.error(err, 'Uncaught exception');
    sendServerError({
      type: 'uncaughtException',
      where: 'process',
      error: err && err.message ? err.message : 'uncaught exception',
      details: err && err.stack ? err.stack : 'no stack',
    });
  });
}

main();