'use strict';

const path = require('path');

exports.extend = (app) =>
{
  app.createError = (message, ...args) =>
  {
    const error = new Error(message);

    for (let i = 0; i < args.length; ++i)
    {
      const v = args[i];

      switch (typeof v)
      {
        case 'string':
          error.code = v;
          break;

        case 'number':
          error.statusCode = v;
          break;

        case 'object':
          Object.assign(error, v);
          break;
      }
    }

    return error;
  };

  /**
   * @param {...string} parts
   * @returns {string}
   */
  app.pathTo = (...parts) => path.join.apply(
    null,
    app.options && app.options.rootPath
      ? [app.options.rootPath].concat(parts)
      : parts
  );

  /**
   * @param {(string|Array.<(string|null)>)} moduleNames
   * @param {function} setUpFunction
   */
  app.onModuleReady = (moduleNames, setUpFunction) =>
  {
    const remainingModuleNames = [].concat(moduleNames);

    if (remainingModuleNames.some(moduleName => !moduleName))
    {
      return;
    }

    const sub = app.broker.subscribe('app.modules.started', ({module}) => checkModule(module.name));

    [].concat(remainingModuleNames).forEach(checkModule);

    function checkModule(moduleName)
    {
      if (app.main.startedModules.includes(moduleName))
      {
        const moduleIndex = remainingModuleNames.indexOf(moduleName);

        if (moduleIndex !== -1)
        {
          remainingModuleNames.splice(moduleIndex, 1);
          setUpIfReady();
        }
      }
    }

    function setUpIfReady()
    {
      if (remainingModuleNames.length === 0)
      {
        sub.cancel();
        setImmediate(setUpFunction);
      }
    }
  };
};
