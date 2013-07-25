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
  './modules/sync',
  './modules/async',
  // Same as ./node_modules/npm-module
  'npm-module'
];

require('h5.main').main(app, modules);
```

`./modules/sync.js`:
```js
exports.start = function(app)
{
  app.syncModule = {};

  app.broker.subscribe('modules.started')
    .setLimit(1)
    .setFilter(function(moduleName) { return moduleName === 'async' })
    .on('message', function()
    {
      app.debug("Hello from sync after async started!");
    });
};
```

`./modules/async.js`:
```js
exports.start = function(app, done)
{
  app.asyncModule = {};

  setTimeout(done, 1000);
};
```

`./node_modules/npm-module/index.js`:
```js
exports.start = function(app)
{
  app.npmModule = {};
};
```

Run the application:
```
node ./main.js
```

Expected output:
```
info    13-07-25 15:01:18.439+02   Starting...
debug   13-07-25 15:01:18.451+02   sync module starting synchronously...
debug   13-07-25 15:01:18.451+02   async module starting asynchronously...
debug   13-07-25 15:01:19.463+02   npm-module module starting synchronously...
info    13-07-25 15:01:19.464+02   Started the development environment in 1036 ms
```

## TODO

  - Tests
  - Readme
  - Documentation
  - npm publish

## License

This project is released under the
[MIT License](https://raw.github.com/morkai/h5.main/master/license.md).
