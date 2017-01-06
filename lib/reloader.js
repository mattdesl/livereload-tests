var URL = require('./url');
var qs = require('query-string');
var createStyleCache = require('./styleCache');

var styleCache = createStyleCache();

module.exports.page = reloadPage;
module.exports.css = reloadCSS;

function reloadPage () {
  window.location.reload(true);
}

function reloadCSS (url) {
  styleCache.update(url);
}