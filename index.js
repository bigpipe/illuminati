'use strict';

var browserify = require('./browserify')
  , minimatch = require("minimatch")
  , child = require('child_process')
  , dot = require('dot-component')
  , fusing = require('fusing')
  , path = require('path')
  , fs = require('fs');

/**
 * Illuminati: Secret society of testers.
 *
 * @constructor
 * @param {String} dir Directory we're loaded in.
 * @param {Object} options Optional options.
 * @api public
 */
function Illuminati(dir, options) {
  if (!(this instanceof Illuminati)) return new Illuminati(dir, options);
  var self = this;

  this.fuse();
  this.root = dir;    // Root directory

  if (fs.existsSync(path.join(dir, 'package.json'))) {
    (function merge(data) {
      Object.keys(data || {}).forEach(function each(key) {
        self.conf[key] = +data[key] || data[key];
      });
    })(require(path.join(dir, 'package.json')).illuminati);
  }
}

fusing(Illuminati, require('eventemitter3'));

/**
 * Find the configuration for the Illuminati runner. We assume that the
 * configuration is added in a special `illuminati` key in the users
 * `package.json` which can be used to configure various of things in the
 * project. This configuration will be merged with our default illuminati
 * configuration from our own `package.json` file.
 *
 * @type {Object}
 * @public
 */
Illuminati.writable('conf', require('./package.json').illuminati);

/**
 * Command line arguments.
 *
 * @type {Object}
 * @public
 */
Illuminati.readable('argv', require('argh').argv);

/**
 * The glob pattern we use for searching valid test files.
 *
 * @type {String}
 * @public
 */
Illuminati.readable('glob', '*.test.js');

/**
 * The assets that need to be served.
 *
 * @type {Array}
 * @public
 */
Illuminati.writable('assets', [
  './node_modules/mocha/mocha.js',
  './node_modules/mocha/mocha.css',
  './index.html'
]);

/**
 * Run the actual test suites.
 *
 * @api public
 */
Illuminati.readable('run', function run() {
  var illuminati = this;

  /**
   * The tests have run.
   *
   * @param {Error} err
   * @api private
   */
  function ran(err) {
    if (err) return process.exit(1);
    return process.exit(0);
  }

  if (!this.argv.phantom) return this.mocha(ran);

  this.server(function listening(err) {
    illuminati.phantomjs(ran);
  });
});

/**
 * Create our HTTP server and start listening on the provide port number.
 *
 * @param {Function} fn Completion callback, server is listening
 * @api private
 */
Illuminati.readable('server', function server(fn) {
  var app = require('http').createServer(this.incoming.bind(this))
    , illuminati = this;

  this.assets = this.assets.map(this.map);

  browserify(this.files, this.conf.browserify || {
    basedir: this.root
  }, function (err, source, map) {
    source += '//# sourceMappingURL=/illuminati.map';
    map.file = '/illuminati.js';

    illuminati.assets.push({
      type: 'text/javascript',
      url: '/illuminati.js',
      data: source
    }, {
      data: JSON.stringify(map),
      type: 'application/json',
      url: '/illuminati.map',
      map: map
    });

    require('connected')(app, illuminati.conf.port, fn);
  });

  //
  // We don't want our HTTP server to hold up the destruction of the world. So
  // we unref it.
  //
  if (app.unref) app.unref();

  return this;
});

/**
 * Run the tests on PhantomJS.
 *
 * @param {Number} port The port number our server is listening on.
 * @param {Function} fn Completion callback.
 * @api private
 */
Illuminati.readable('phantomjs', function phantomjs(fn) {
  var phantom = child.spawn(
    path.join(__dirname, 'node_modules', '.bin', 'mocha-phantomjs'), [
      'http://localhost:'+ this.conf.port
  ], {
    stdio: 'inherit'
  });

  phantom.on('close', function exit(code) {
    if (code) {
      return fn(new Error('Tests failed to run, returned exit code: '+ code));
    }

    fn();
  });

  return this;
});

/**
 * Run the tests against the regular mocha.
 *
 * @param {Function} fn Completion function.
 * @api private
 */
Illuminati.readable('mocha', function mochas(fn) {
  var mocha = child.spawn(
    path.join(__dirname, 'node_modules', '.bin', 'mocha'), [
      '--reporter', this.conf.reporter,
      '--ui', this.conf.ui
    ].concat(this.files), {
    stdio: 'inherit'
  });

  mocha.on('close', function exit(code) {
    if (code) {
      return fn(new Error('Tests failed to run, returned exit code: '+ code));
    }

    fn();
  });

  return this;
});

/**
 * Find the files that we need to test for.
 *
 * @type {Array}
 * @public
 */
Illuminati.get('files', function files() {
  if (this.argv.argv) return this.argv.argv;

  var illuminati = this;

  return [
    path.join(illuminati.root, 'tests'),
    path.join(illuminati.root, 'test')
  ].reduce(function reduce(files, dir) {
    var folder;

    try { folder = fs.readdirSync(dir); }
    catch (e) { return files; }

    Array.prototype.push.apply(files, folder.filter(function filter(file) {
      return minimatch(file, illuminati.glob);
    }).map(function map(file) {
      return path.join(dir, file);
    }));

    return files;
  }, []);
});

/**
 * Introduce template tags into the given template.
 *
 * @param {Object} data Information to merge.
 * @param {String} template Template to replace
 * @returns {String} The template
 * @api private
 */
Illuminati.readable('introduce', function introduce(data, template) {
  var key; template = template.toString();

  while (key = /{illuminati:([^{]+?)}/gm.exec(template)) {
    key = key[0];
    template = template.replace(key, dot.get(data, key.slice(12, -1)));
  }

  return template;
});

/**
 * Map assets to an object that we can serve.
 *
 * @param {String} file Filename/address.
 * @returns {Object} Serve-able object
 * @api public
 */
Illuminati.readable('map', function map(file) {
  if ('string' !== typeof file) {
    return file; // Already processed, do not give a fuck
  }

  return {
    data: fs.readFileSync(path.join(__dirname, file), 'utf-8'),
    url: '/'+ path.basename(file),
    type: {
      js:   'text/javascript',
      css:  'text/css',
      html: 'text/html',
      json: 'application/json'
    }[path.extname(file).slice(1)] || 'text/plain'
  };
});

/**
 * Answer HTTP requests to our incoming test server.
 *
 * @param {Request} req HTTP request.
 * @param {Response} res HTTP response.
 * @api private
 */
Illuminati.readable('incoming', function incoming(req, res) {
  res.statusCode = 200;

  var illuminati = this;

  if (req.url === '/') req.url = '/index.html';
  if (illuminati.assets.some(function some(asset) {
    if (asset.url !== req.url) return false;

    res.setHeader('Content-Type', asset.type);
    res.end(illuminati.introduce(illuminati.conf, asset.data));

    return true;
  })) return;

  res.statusCode = 404;
  res.end('404: Please read the documentation on: '+ illuminati.conf.homepage);
});

//
// Expose the module.
//
module.exports = Illuminati;
