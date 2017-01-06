var budo = require('budo');
var ws = require('ws');
var WebSocketServer = ws.Server;
var path = require('path');
var browserify = require('browserify');
var clientFile = path.resolve(__dirname, 'livereload-client.js');

var wss;
var reloadOnStartup = false;
var appDir = __dirname;

budo.cli(process.argv.slice(2), {
  middleware: middleware
}).on('connect', function (ev) {
  console.log('LiveReload connected.');
  wss = new WebSocketServer({
    server: ev.server,
    perMessageDeflate: false
  });
  if (reloadOnStartup) {
    wss.once('connection', function () {
      reload();
    });
  }
}).on('pending', function () {
  reload();
}).watch('**/*.{html,css}').on('watch', function (ev, file) {
  var url = path.relative(appDir, file).replace(new RegExp(path.sep, 'g'), '/');
  var ext = path.extname(file);
  if (ext === '.css') {
    broadcast(url);
  } else {
    reload();
  }
});

function reload () {
  if (!wss) return;
  broadcast();
}

function broadcast (data) {
  if (!wss) return;
  wss.clients.forEach(function (client) {
    client.send(data || '', {
      binary: false
    });
  });
}

function middleware (req, res, next) {
  if (req.url === '/livereload.js') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/javascript');

    var b = browserify({ debug: false });
    b.add(clientFile);
    b.bundle().pipe(res);
  } else {
    next(null);
  }
}
