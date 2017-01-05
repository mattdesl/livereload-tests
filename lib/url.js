var URL = require('url');

module.exports.resolve = URL.resolve.bind(URL);
module.exports.format = URL.format.bind(URL);

module.exports.parse = function (url) {
  var protocol = document.location.protocol;
  if (url.indexOf('//') === 0) url = protocol + url;
  return URL.parse(url);
};

module.exports.key = function (url) {
  // strip hash/query and get a resolved URL
  var parsed = URL.parse(url);
  url = URL.format({
    pathname: (parsed.pathname || '').replace(/\/+$/, '/')
  });
  var base = document.location.pathname;
  return URL.resolve(base, url);
};
