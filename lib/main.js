'use strict';

var DEFAULT_OPTIONS = {
  moduleStartTimeout: 2000,
  rootPath: process.cwd(),
  env: process.env.NODE_ENV || 'development',
  startTime: Date.now(),
  id: 'nonameapp'
};

var step = require('h5.step');
var MessageBroker = require('h5.pubsub').MessageBroker;
var appUtils = require('./utils/app');
var logUtils = require('./utils/log');

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

  appUtils.extend(app);
  logUtils.extend(app);

  /**
   * @private
   * @param {object} module
   * @param {object} appModule
   * @returns {Error|null}
   */
  function startModuleSync(module, appModule)
  {
    app.debug("%s module starting synchronously...", module.name);

    try
    {
      appModule.start(app, module);
    }
    catch (err)
    {
      return err;
    }

    app.broker.publish('app.modules.started', module.name);

    return null;
  }

  /**
   * @private
   * @param {object} module
   * @param {object} appModule
   * @param {function(Error|null)} done
   */
  function startModuleAsync(module, appModule, done)
  {
    app.debug("%s module starting asynchronously...", module.name);

    var startTimer = app.timeout(app.options.moduleStartTimeout, function()
    {
      app.error(
        "%s module failed to start in the allowed time of %ds",
        module.name,
        app.options.moduleStartTimeout / 1000
      );

      process.exit(1);
    });

    appModule.start(app, module, function(err)
    {
      clearTimeout(startTimer);

      if (err)
      {
        if (!(err instanceof Error))
        {
          err = new Error(err.toString());
          err.stack = null;
        }

        err.moduleName = module.name;
      }
      else
      {
        app.broker.publish('app.modules.started', module.name);
      }

      done(err);
    });
  }

  /**
   * @private
   * @param {Array.<function>} startModules
   * @param {object} module
   * @param {object} appModule
   * @returns {function(Error|null)}
   */
  function createStartModuleStep(startModules, module, appModule)
  {
    return function startModuleStep(err)
    {
      if (err)
      {
        return this.skip(err);
      }

      app.main.startedModules.push(module.name);

      app[module.name] = module;

      app.broker.publish('app.modules.starting', module.name);

      startModules.currentModuleName = module.name;

      if (appModule.start.length === 3)
      {
        startModuleAsync(module, appModule, this.next());
      }
      else
      {
        err = startModuleSync(module, appModule);

        if (err)
        {
          this.skip(err);
        }
      }
    };
  }

  /**
   * @private
   * @param {Array.<function>} startModules
   * @param {object} module
   */
  function addStartModule(startModules, module)
  {
    /*jshint eqnull:true*/

    if (module.path.charAt(0) === '.')
    {
      module.path = app.pathTo(module.path);
    }
    else
    {
      module.path = app.pathTo('node_modules', module.path);
    }

    var appModule;

    try
    {
      appModule = require(module.path);
    }
    catch (err)
    {
      app.error(
        "%s module failed to load: %s",
        module.name,
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
        module.name
      );

      process.exit(1);
    }

    var config = module.config || {};

    if (appModule.DEFAULT_CONFIG != null)
    {
      Object.keys(appModule.DEFAULT_CONFIG).forEach(function(configKey)
      {
        if (config[configKey] === undefined)
        {
          config[configKey] = appModule.DEFAULT_CONFIG[configKey];
        }
      });
    }

    module.config = config;

    logUtils.extend(module, '[' + module.name + '] ');

    startModules.push(createStartModuleStep(
      startModules, module, appModule
    ));
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

      var env = app.options.env;
      var time = Date.now() - app.options.startTime;

      app.info("Started the %s environment in %d ms", env, time);

      app.broker.publish('app.started', {
        id: app.options.id,
        env: env,
        time: time
      });
    }
  );
};
