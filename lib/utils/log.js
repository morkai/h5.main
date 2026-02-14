'use strict';

const ENABLED = {
  debug: true,
  info: true,
  warn: true,
  error: true
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cyclic_object_value
const getCircularReplacer = () =>
{
  const seen = new WeakSet();

  return (key, value) =>
  {
    if (typeof value === 'object' && value !== null)
    {
      if (seen.has(value))
      {
        return;
      }

      seen.add(value);
    }

    return value;
  };
};

function extend(object, extras)
{
  Object.keys(ENABLED).forEach(severity =>
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
      let error;

      for (let i = 0; i < args.length; ++i)
      {
        const arg = args[i];

        if (!arg)
        {
          continue;
        }

        if (typeof arg === 'string')
        {
          log.message = arg;
        }
        else if (arg instanceof Error)
        {
          error = {
            stack: arg.stack || arg.message,
            ...arg
          };
        }
        else
        {
          Object.assign(log, arg);
        }
      }

      if (error)
      {
        log.error = error;
      }

      exports.write(log);
    };
  });
}

function create(extras)
{
  return (childExtras) =>
  {
    const mergedExtras = {...extras, ...childExtras};
    const logger = {
      enabled: ENABLED,
      extend: (childObject, childExtras) => exports.extend(childObject, {...mergedExtras, ...childExtras}),
      create: create(mergedExtras)
    };

    extend(logger, mergedExtras);

    return logger;
  };
}

exports.write = (log) => process.stdout.write(JSON.stringify(log, getCircularReplacer()) + '\n');

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
    create: create(extras)
  };

  extend(object, extras);

  return object;
};
