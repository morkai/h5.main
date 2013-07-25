'use strict';

var format = require('util').format;

/**
 * @param {object} object
 */
exports.extend = function(object)
{
  ['debug', 'info', 'warn', 'error'].forEach(function(level)
  {
    object[level] = function()
    {
      log(level, Array.prototype.slice.call(arguments));
    };
  });
};

function log(level, args)
{
  var message = level + '\t' + getDateString()
    + '\t' + format.apply(null, args).trim() + '\n';

  if (level === 'error')
  {
    process.stderr.write(message);
  }
  else
  {
    process.stdout.write(message);
  }
}

function getDateString()
{
  var now = new Date();
  var str = now.getFullYear().toString().substr(2)
    + '-' + pad0(now.getMonth() + 1)
    + '-' + pad0(now.getDate())
    + ' ' + pad0(now.getHours())
    + ':' + pad0(now.getMinutes())
    + ':' + pad0(now.getSeconds())
    + '.';

  var ms = now.getMilliseconds();

  if (ms < 10)
  {
    str += '00';
  }
  else if (ms < 100)
  {
    str += '0';
  }

  str += ms;
  str += '+' + pad0(now.getTimezoneOffset() / 60 * -1);

  return str;
}

function pad0(str)
{
  return (str.toString().length === 1 ? '0' : '') + str;
}
