'use strict';

exports.DEFAULT_CONFIG = {
  a: 1
};

exports.start = function(app, module)
{
  app.setUpExternalModule('async', function()
  {
    app.debug("Hello from %s after async started!", module.name);
    module.debug("a^2=%d", Math.pow(module.config.a, 2));
  });
};
