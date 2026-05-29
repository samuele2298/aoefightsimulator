'use strict';

const logger = require('../../logger');
const { setBroadcaster } = require('./simulationManager');

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
    });
  });
}

module.exports = {
  registerWsHandlers,
};
