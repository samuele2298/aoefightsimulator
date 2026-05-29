'use strict';

/**
 * @module modules/logger
 * @description Singleton Winston logger shared across the application.
 */

const winston = require('winston');
const { combine, printf } = winston.format;
const config = require('./config');

const loggerFormat = printf(({ level, message }) => {
    return `[${level.toUpperCase()}] ${message}`;
});

const logger = winston.createLogger({
    level: config.log_level,
    format: combine(
        loggerFormat
    ),
    exitOnError: false,
    transports: [new winston.transports.Console()]
});

/**
 * Configured Winston logger instance.
 * @type {object}
 */
module.exports = logger;
