'use strict';

const DEFAULT_OPTIONS = {
  moduleStartTimeout: 2000,
  rootPath: process.cwd(),
  env: process.env.NODE_ENV || 'development',
  startTime: Date.now(),
  id: 'nonameapp'
};

const step = require('h5.step');
const {MessageBroker} = require('h5.pubsub');
const appUtils = require('./utils/app');
const logUtils = require('./utils/log');

module.exports = (app, modules) =>
{
  if (app === null || typeof app !== 'object')
  {
    app = {};
  }

  if (app.options === null || typeof app.options !== 'object')
  {
    app.options = {};
  }

  app.options = {...DEFAULT_OPTIONS, ...app.options};
  app.broker = new MessageBroker();
  app.main = {
    modules: {},
    appModules: {},
    setUpModules: [],
    startedModules: []
  };

  appUtils.extend(app);
  logUtils.extend(app, {appId: app.options.id});

  /**
   * @private
   * @param {Object} module
   * @param {Object} appModule
   * @param {function} done
   */
  function startModuleSync(module, appModule, done)
  {
    setUpRequiredDependencies(module, appModule);
    setUpOptionalDependencies(module, appModule);

    if (appModule.start)
    {
      appModule.start(app, module);
    }

    app.broker.publish('app.modules.started', {module, appModule});

    setImmediate(done);
  }

  /**
   * @private
   * @param {Object} module
   * @param {Object} appModule
   * @param {function} done
   */
  function startModuleAsync(module, appModule, done)
  {
    const startTimer = setTimeout(
      () => { throw new Error(`[${module.name}] module failed to start in the allowed time!`); },
      app.options.moduleStartTimeout
    );

    setUpRequiredDependencies(module, appModule);
    setUpOptionalDependencies(module, appModule);

    appModule.start(app, module, (err) =>
    {
      clearTimeout(startTimer);

      if (err)
      {
        throw err;
      }

      app.broker.publish('app.modules.started', {module, appModule});

      setImmediate(done);
    });
  }

  function setUpRequiredDependencies(module, appModule)
  {
    const requiredModules = typeof appModule.requiredModules === 'string'
      ? appModule.requiredModules.split(' ')
      : appModule.requiredModules;

    if (!Array.isArray(requiredModules))
    {
      return;
    }

    requiredModules.forEach(moduleProperty =>
    {
      const requiredModuleName = module.config[`${moduleProperty}Id`];
      const requiredModule = app[requiredModuleName];

      if (!requiredModule)
      {
        throw new Error(`[${module.name}] module requires the [${moduleProperty}] module!`);
      }

      module[moduleProperty] = requiredModule;
    });
  }

  function setUpOptionalDependencies(module, appModule)
  {
    Object.keys(appModule.optionalModules || {}).forEach(optionalModules =>
    {
      const setUpFunctions = appModule.optionalModules[optionalModules];
      const deps = new Map();

      optionalModules.split(' ').forEach(depModuleProperty =>
      {
        deps.set(depModuleProperty, module.config[`${depModuleProperty}Id`]);
      });

      app.onModuleReady(Array.from(deps.values()), () =>
      {
        deps.forEach((depModuleName, depModuleProperty) =>
        {
          module[depModuleProperty] = app[depModuleName];
        });

        if (Array.isArray(setUpFunctions))
        {
          setUpFunctions.forEach(setUp => setUp(app, module));
        }
        else if (typeof setUpFunctions === 'function')
        {
          setUpFunctions(app, module);
        }
      });
    });
  }

  /**
   * @private
   * @param {Array.<function>} startModules
   * @param {Object} module
   * @param {Object} appModule
   * @returns {function((Error|null))}
   */
  function createStartModuleStep(startModules, module, appModule)
  {
    return function startModuleStep()
    {
      module.info(`Starting...`);

      app.main.startedModules.push(module.name);

      app[module.name] = module;

      app.broker.publish('app.modules.starting', {module, appModule});

      if (appModule.start && appModule.start.length === 3)
      {
        startModuleAsync(module, appModule, this.next());
      }
      else
      {
        startModuleSync(module, appModule, this.next());
      }
    };
  }

  /**
   * @private
   * @param {Array.<function>} startModules
   * @param {Object} module
   */
  function addStartModule(startModules, module)
  {
    const moduleName = module.name;

    app.logger.extend(module, {
      module: moduleName
    });

    module.info(`Setting up...`);

    const appModule = require(module.path);

    if (appModule === null || typeof appModule !== 'object')
    {
      module.info(`Skipping empty module.`);

      return;
    }

    if (!module.config)
    {
      module.config = {};
    }

    if (appModule.DEFAULT_CONFIG != null)
    {
      Object.keys(appModule.DEFAULT_CONFIG).forEach(configKey =>
      {
        if (module.config[configKey] === undefined)
        {
          module.config[configKey] = appModule.DEFAULT_CONFIG[configKey];
        }
      });
    }

    app.main.modules[moduleName] = module;
    app.main.appModules[moduleName] = appModule;

    app.broker.publish('app.modules.settingUp', {module, appModule});

    if (typeof appModule.setUp === 'function')
    {
      appModule.setUp(app, module);
    }

    app.broker.publish('app.modules.setUp', {module, appModule});

    if (typeof appModule.onModuleSetUp === 'function')
    {
      app.main.setUpModules.forEach(moduleName =>
      {
        appModule.onModuleSetUp(app, {
          moduleName,
          module,
          appModule,
          setUpModule: app.main.modules[moduleName],
          setUpAppModule: app.main.appModules[moduleName]
        });
      });

      app.broker.subscribe('app.modules.setUp', m =>
      {
        appModule.onModuleSetUp(app, {
          module,
          appModule,
          setUpModule: m.module,
          setUpAppModule: m.appModule
        });
      });
    }

    app.main.setUpModules.push(moduleName);

    startModules.push(createStartModuleStep(
      startModules, module, appModule
    ));
  }

  step(
    function startModulesStep()
    {
      app.info('Starting...');

      const startModules = [];

      modules.forEach(addStartModule.bind(null, startModules));

      startModules.push(this.next());

      step(startModules);
    },
    function finishStartupStep()
    {
      const env = app.options.env;
      const time = Date.now() - app.options.startTime;

      app.info(`Started.`, {env, startTime: time});

      app.broker.publish('app.started', {
        id: app.options.id,
        env,
        time
      });
    }
  );
};
