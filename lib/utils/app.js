'use strict';

var fs = require('fs');
var path = require('path');
var step = require('h5.step');

exports.extend = function(app)
{
  /**
   * @param {*} err
   * @returns {string}
   */
  app.stackOrMessage = function(err)
  {
    if (!err)
    {
      return '';
    }

    if (!(err instanceof Error))
    {
      return err.toString();
    }

    return err.stack || err.message;
  };

  /**
   * @param {number} time
   * @param {function} cb
   * @returns {number}
   */
  app.timeout = function(time, cb)
  {
    return setTimeout(cb, time);
  };

  /**
   * @param {string...} partN
   * @returns {string}
   */
  app.pathTo = function()
  {
    var parts = Array.prototype.slice.call(arguments);

    if (app.options && app.options.rootPath)
    {
      parts.unshift(app.options.rootPath);
    }

    return path.join.apply(null, parts);
  };

  /**
   * Serially loads files ending with `.js` from the specified directory.
   *
   * `index.js` file and files with names starting with `.` are ignored.
   *
   * @param {string} dir
   * @param {Array} args
   * @param {function} done
   */
  app.loadDir = function(dir, args, done)
  {
    fs.readdir(dir, function(err, files)
    {
      if (err)
      {
        return done(err);
      }

      files = files.filter(function(file)
      {
        if (file[0] === '.' || file === 'index.js')
        {
          return false;
        }

        var dotPos = file.lastIndexOf('.');

        return dotPos !== -1 && file.substr(dotPos + 1, 2) === 'js';
      });

      if (files.length === 0)
      {
        return done();
      }

      app.loadFiles(dir, files, args, done);
    });
  };

  /**
   * Serially loads the specified files.
   *
   * @param {string|null} dir
   * @param {Array.<string>} files
   * @param {Array} args
   * @param {function} done
   */
  app.loadFiles = function(dir, files, args, done)
  {
    var fileLoaders = [];

    files.forEach(function(file)
    {
      fileLoaders.push(function(err)
      {
        if (err)
        {
          return this.skip(err);
        }

        var appModule = require(path.join(dir, file));

        if (typeof appModule !== 'function')
        {
          return;
        }

        if (appModule.length === args.length + 1)
        {
          appModule.apply(null, [].concat(args, this.next()));

          return;
        }

        try
        {
          appModule.apply(null, args);
        }
        catch (err)
        {
          this.skip(err);
        }
      });
    });

    fileLoaders.push(done);

    step(fileLoaders);
  };

  /**
   * @param {string} externalModuleName
   * @param {function} setUpFunction
   */
  app.setUpExternalModule = function(externalModuleName, setUpFunction)
  {
    if (app.main.startedModules.indexOf(externalModuleName) !== -1)
    {
      return setUpFunction();
    }

    app.broker.subscribe('app.modules.started', setUpFunction)
      .setLimit(1)
      .setFilter(function(moduleName)
      {
        return moduleName === externalModuleName;
      });
  };
};
