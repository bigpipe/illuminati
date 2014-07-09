'use strict';

var Backtrace = require('backtrace')
  , stackmap = require('stack-mapper');

//
// Access the original error so we can inherit from it
//
var Illuminati = 'undefined' !== typeof window
  ? window.Error
  : global.Error;

/**
 * Create a custom error instance that will automatically map a given source map
 * to the received or internal `stack` property.
 *
 * @constructor
 * @api public
 */
function Error() {
  Illuminati.apply(this, arguments);

  if (!this.stack) try { throw new Illuminati(); }
  catch (e) { this.stack = e.stack || this.stack; }

  var backtrace = new Backtrace({ error: this })
    , sourcemap = stackmap(Error.sourcemap).map(backtrace.traces);

  //this.stringify(backtrace.traces, sourcemap);
}

Error.prototype = new Illuminati;
Error.prototype.constructor = Error;

/**
 * Make sure that the new stack trace is also fully human readable.
 *
 * @param {Array} traces The stack trace traces.
 * @param {Array} frames The mapped source map frames.
 * @api private
 */
Error.prototype.stringify = function stringify(traces, frames) {
  var stack = [];

  for (var i = 0, length = traces.length; i < length; i++) {
    var trace = traces[i]
      , map = frames[i]
      , location = [];

    if (map.file) location.push(map.file);
    else if (trace.file) location.push(trace.file);

    if (map.line) location.push(map.line);
    else if (trace.line) location.push(trace.line);

    if (map.column) location.push(map.column);
    else if (trace.column) location.push(trace.column);

    stack.push(
      '    at '+ trace.name +' ('+ location.join(':') +')'
    );
  }

  this.stack = stack.join('\n\r');
};

//
// Provide a hook for external content to override our source map
// information
//
Error.sourcemap = {};

//
// Bump the stack trace limit to get some more detailed information about the
// failures.
//
Error.stackTraceLimit = Illuminati.stackTraceLimit = 25;

if ('undefined' !== typeof global) global.Error = Error;
if ('undefined' !== typeof window) window.Error = Error;
