'use strict';

const { exec } = require('child_process');

const logger = require('../../logger');
const { reloadAllData } = require('./loader');

function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout || '');
    });
  });
}

async function refreshAoe4Data() {
  logger.info('Refreshing aoe4data package...');
  await runCommand('npm install github:aoe4world/data');
  reloadAllData();
  logger.info('aoe4data refresh completed.');
  return { ok: true };
}

module.exports = {
  refreshAoe4Data,
};
