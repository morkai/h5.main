'use strict';

var app = {
  options: {
    moduleStartTimeout: 2000,
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

require('../lib').main(app, modules);
