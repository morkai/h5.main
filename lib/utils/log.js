'use strict';

const util = require('util');

const ENABLED = {
  debug: true,
  info: true,
  warn: true,
  error: true
};

exports.write = (log) => console.log(JSON.stringify(log));

/**
 * @param {Object} object
 * @param {Object} [extras]
 * @returns {Object}
 */
exports.extend = (object, extras) =>
{
  object.logger = {
    enabled: ENABLED,
    extend: (childObject, childExtras) => exports.extend(childObject, {...extras, ...childExtras}),
    create: (childExtras) => exports.extend({}, {...extras, ...childExtras})
  };

  ['debug', 'info', 'warn', 'error'].forEach(severity =>
  {
    object[severity] = (...args) =>
    {
      if (!ENABLED[severity])
      {
        return;
      }

      const log = {
        severity,
        time: new Date(),
        ...extras
      };

      for (let i = 0; i < args.length; ++i)
      {
        const arg = args[i];

        if (!arg)
        {
          continue;
        }

        if (i > 0 && typeof log.message === 'string' && log.message.includes('%'))
        {
          log.message = util.format.apply(util, [log.message, ...args.slice(i)]);

          break;
        }

        if (typeof arg === 'string')
        {
          log.message = arg;
        }
        else if (arg instanceof Error)
        {
          log.error = {
            stack: arg.stack || arg.message,
            ...arg
          };
        }
        else
        {
          Object.assign(log, arg);
        }
      }

      exports.write(log);
    };
  });

  return object;
};
