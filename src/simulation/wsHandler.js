'use strict';

const logger = require('../../logger');
const { setBroadcaster } = require('./simulationManager');
const { sendServerError } = require('../tg');

function registerWsHandlers(wss) {
  setBroadcaster((payload) => {
    const text = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client.readyState === 1) {
        client.send(text);
      }
    }
  });

  wss.on('connection', (socket) => {
    logger.info('WebSocket client connected');
    const ip = socket && socket._socket ? socket._socket.remoteAddress : 'unknown';

    socket.send(
      JSON.stringify({
        type: 'ws:ready',
        payload: { message: 'Connected to AoE4 simulation stream' },
      })
    );

    socket.on('close', () => {
      logger.info('WebSocket client disconnected');
    });

    socket.on('error', (error) => {
      logger.error(error, 'WebSocket client error');
      sendServerError({
        type: 'ws-client',
        where: '/ws connection',
        ip,
        error: error && error.message ? error.message : 'WebSocket client error',
        details: error && error.stack ? error.stack : 'no stack',
      });
    });
  });

  wss.on('error', (error) => {
    logger.error(error, 'WebSocket server error');
    sendServerError({
      type: 'ws-server',
      where: '/ws server',
      error: error && error.message ? error.message : 'WebSocket server error',
      details: error && error.stack ? error.stack : 'no stack',
    });
  });
}

module.exports = {
  registerWsHandlers,
};
