'use strict';

var convert = require('convert-source-map')
  , browserify = require('browserify')
  , path = require('path')
  , fs = require('fs');

/**
 * Compile all the things.
 *
 * @param {Array} files Files to be included in the bundle.
 * @param {Object} options Options for browserify.
 * @param {Function} fn Completion callback.
 * @api public
 */
module.exports = function compile(files, options, fn) {
  if ('function' === typeof options) {
    fn = options;
    options = {};
  }

  //
  // Introduce our `assume` library by default in to the package so you only
  // need Illuminati to start testing your applications and add all other files
  // that are needed to test all the things.
  //
  options.builtins = require('browserify/lib/builtins.js');
  options.builtins.assume = require.resolve('assume');

  var b = browserify(options);

  //
  // Add all the test files as entry files so they will be executed when the
  // browserify bundle is loaded. If they are not executed, we will not be able
  // to run the test suite.
  //
  files.forEach(b.add.bind(b));

  b.bundle({
    debug: true           // Ensure that browserify is compiled with source-maps.
  }, function bundled(err, source) {
    if (err) return fn(err);

    //
    // PhantomJS does not understand base64 encoded source maps so we have to
    // convert the created sourcemap to a JSON file which we can serve from our
    // server.
    //
    var map = convert.fromSource(source);

    fn(undefined, convert.removeComments(source), map ? map.toObject() : undefined);
  });
};
