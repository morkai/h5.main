'use strict';

var DEFAULT_OPTIONS = {
  moduleStartTimeout: 2000,
  rootPath: process.cwd(),
  env: process.env.NODE_ENV || 'development',
  startTime: Date.now()
};

var step = require('h5.step');
var MessageBroker = require('h5.pubsub').MessageBroker;

module.exports = function(app, modules)
{
  if (app === null || typeof app !== 'object')
  {
    app = {};
  }

  if (app.options === null || typeof app.options !== 'object')
  {
    app.options = {};
  }

  Object.keys(DEFAULT_OPTIONS).forEach(function(optionName)
  {
    if (typeof app.options[optionName] === 'undefined')
    {
      app.options[optionName] = DEFAULT_OPTIONS[optionName];
    }
  });

  app.broker = new MessageBroker();
  app.main = {
    startedModules: []
  };

  require('./utils/app').extend(app);
  require('./utils/log').extend(app);

  /**
   * @private
   * @param {string} moduleName
   * @param {object} appModule
   * @returns {Error|null}
   */
  function startModuleSync(moduleName, appModule)
  {
    app.debug("%s module starting synchronously...", moduleName);

    try
    {
      appModule.start(app);
    }
    catch (err)
    {
      return err;
    }

    app.broker.publish('modules.started', moduleName);

    return null;
  }

  function startModuleAsync(moduleName, appModule, done)
  {
    app.debug("%s module starting asynchronously...", moduleName);

    var startTimer = app.timeout(app.options.moduleStartTimeout, function()
    {
      app.error(
        "%s module failed to start in the allowed time of %ds",
        moduleName,
        app.options.moduleStartTimeout / 1000
      );

      process.exit(1);
    });

    appModule.start(app, function(err)
    {
      clearTimeout(startTimer);

      if (err)
      {
        if (!(err instanceof Error))
        {
          err = new Error(err.toString());
          err.stack = null;
        }

        err.moduleName = moduleName;
      }
      else
      {
        app.broker.publish('modules.started', moduleName);
      }

      done(err);
    });
  }

  function createStartModuleStep(startModules, moduleName, appModule)
  {
    return function startModuleStep(err)
    {
      if (err)
      {
        return this.skip(err);
      }

      app.main.startedModules.push(moduleName);

      app.broker.publish('modules.starting', moduleName);

      startModules.currentModuleName = moduleName;

      if (appModule.start.length === 1)
      {
        err = startModuleSync(moduleName, appModule);

        if (err)
        {
          this.skip(err);
        }
      }
      else
      {
        startModuleAsync(moduleName, appModule, this.next());
      }
    };
  }

  function addStartModule(startModules, modulePath)
  {
    var moduleName = getModuleNameFromPath(modulePath);

    if (modulePath.charAt(0) === '.')
    {
      modulePath = app.pathTo(modulePath);
    }
    else
    {
      modulePath = app.pathTo('node_modules', modulePath);
    }

    var appModule;

    try
    {
      appModule = require(modulePath);
    }
    catch (err)
    {
      app.error(
        "%s module failed to load: %s",
        moduleName,
        app.stackOrMessage(err.stack)
      );

      process.exit(1);
    }

    if (appModule === null
      || typeof appModule !== 'object'
      || typeof appModule.start !== 'function')
    {
      app.error(
        "%s is not a valid module: missing the start() function",
        moduleName
      );

      process.exit(1);
    }

    startModules.push(createStartModuleStep(
      startModules, moduleName, appModule
    ));
  }

  function getModuleNameFromPath(modulePath)
  {
    var parts = modulePath.split('/');

    return parts[parts.length - 1];
  }

  step(
    function startModulesStep()
    {
      app.info('Starting...');

      var startModules = [];

      modules.forEach(addStartModule.bind(null, startModules));

      var next = this.next();

      startModules.push(function(err)
      {
        if (err && !err.moduleName)
        {
          err.moduleName = startModules.currentModuleName;
        }

        next(err);
      });

      step(startModules);
    },
    function finishStartupStep(err)
    {
      if (err)
      {
        app.error(
          "%s module failed to start: %s",
          err.moduleName,
          app.stackOrMessage(err)
        );

        process.exit(1);
      }

      app.info(
        "Started the %s environment in %d ms",
        app.options.env,
        Date.now() - app.options.startTime
      );

      app.broker.publish('app.started');
    }
  );
};
