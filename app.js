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

const app = express();

// Security / parse
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

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

// Create HTTP server and attach WebSocket server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
registerWsHandlers(wss);

server.listen(config.port, () => {
  logger.info(`AoE4 Fight Simulator running on http://localhost:${config.port}`);
});

module.exports = { app, server, wss };
