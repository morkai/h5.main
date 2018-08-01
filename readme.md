# h5.main

Module starter for Node.js applications.

[![Build Status](https://travis-ci.org/morkai/h5.main.png?branch=master)](https://travis-ci.org/morkai/h5.main)

## Example

```
npm install git://github.com/morkai/h5.main
```

Create the following files:

`./main.js`:
```js
var app = {
  options: {
    // Will process.exit(1) if a module doesn't call done() in the specified time
    moduleStartTimeout: 2000,
    // Used to resolve the specified module paths
    rootPath: process.cwd(),
    env: process.env.NODE_ENV || 'development',
    startTime: Date.now()
  }
};

var modules = [
  {name: 'sync1', path: './modules/sync', config: {a: 2}},
  {name: 'async', path: './modules/async'},
  {name: 'sync2', path: './modules/sync'},
  // Same as ./node_modules/npm-module
  {name: 'npm-module', path: 'npm-module'}
];

require('h5.main').main(app, modules);
```

`./modules/sync.js`:
```js
exports.DEFAULT_CONFIG = {
  a: 1
};

exports.setUp = function(app, module)
{
  app.debug("Setting up %s...", module.name);
};

exports.start = function(app, module)
{
  app.setUpExternalModule('async', function()
  {
    app.debug("Hello from %s after async started!", module.name);
    module.debug("a^2=%d", Math.pow(module.config.a, 2));
  });
};
```

`./modules/async.js`:
```js

exports.setUp = function(app, module)
{
  app.debug("Setting up %s...", module.name);
};

exports.start = function(app, module, done)
{
  setTimeout(done, 1000);
};
```

`./node_modules/npm-module/index.js`:
```js

exports.setUp = function(app, module)
{
  app.debug("Setting up %s...", module.name);
};

exports.start = function(app, module)
{

};
```

Run the application:
```
node ./main.js
```

Expected output:
```
info  13-09-20 20:29:35.198+02 Starting...
debug 13-09-20 20:29:35.216+02 sync1 module starting synchronously...
debug 13-09-20 20:29:35.217+02 async module starting asynchronously...
debug 13-09-20 20:29:36.229+02 Hello from sync1 after async started!
debug 13-09-20 20:29:36.229+02 [sync1] a^2=4
debug 13-09-20 20:29:36.229+02 sync2 module starting synchronously...
debug 13-09-20 20:29:36.230+02 Hello from sync2 after async started!
debug 13-09-20 20:29:36.230+02 [sync2] a^2=1
debug 13-09-20 20:29:36.233+02 npm-module module starting synchronously...
info  13-09-20 20:29:36.233+02 Started the development environment in 1053 ms
```

## TODO

  - Tests
  - Readme
  - Documentation
  - npm publish

## License

This project is released under the
[MIT License](https://raw.github.com/morkai/h5.main/master/license.md).
