var URL = require('./url');

// Reference:
// https://github.com/andrewdavey/vogue/
module.exports = getLocalStylesheets;
function getLocalStylesheets () {
  var baseHosts = getBaseHosts();
  var results = [];
  var links = elements('link');
  var imports = [];

  // Look for local <link> tags
  links.forEach(function (link) {
    if (isPrintMedia(link) || !isLocalStylesheet(link)) {
      return;
    }

    // Find any @import tags
    recursiveCollectImports(link, link.sheet, imports);

    var href = link.getAttribute('href');
    var key = URL.key(href);
    results.push({ key: key, parent: link, link: link, href: href });
  });

  // Also look for @import tags in style elements
  var styles = elements('style');
  styles.forEach(function (style) {
    if (isPrintMedia(style)) return;
    recursiveCollectImports(style, style.sheet, imports);
  });

  imports.forEach(function (imported) {
    var parentHref = imported.parentStyleSheet.href || document.location.href;
    var absHref = URL.resolve(parentHref, imported.href);
    // var parentKey = URL.key(parentHref);
    var key = URL.key(absHref);
    results.push({ key: key, parent: imported.parentStyleSheet, imported: imported, href: imported.href });
  });

  return results;

  function isLocalStylesheet (link) {
    var href = link.getAttribute('href');
    if (!href || link.getAttribute('rel') !== 'stylesheet') return false;
    var parsed = URL.parse(href);
    if (parsed.protocol && parsed.protocol !== window.document.location.protocol) {
      // different protocol, let's assume not local
      return false;
    }
    if (parsed.host) {
      // see if domain matches
      return baseHosts.indexOf(parsed.host.toLowerCase()) >= 0;
    }
    // no host / protocol... assume relative and thus local
    return true;
  }

  function isPrintMedia (link) {
    return link.getAttribute('media') === 'print';
  }

  function elements (tag) {
    return Array.prototype.slice.call(document.getElementsByTagName(tag));
  }

  function getBaseHosts () {
    var baseHosts = [
      'localhost', '127.0.0.1'
    ].map(function (h) {
      return h + ':' + window.document.location.port;
    });

    // handle current
    if (window.document.location.hostname !== 'localhost') {
      baseHosts = baseHosts.concat([ window.document.location.host ]);
    }

    // normalize case
    return baseHosts.map(function (h) {
      return h.toLowerCase();
    });
  }

  function recursiveCollectImports (element, styleSheet, result) {
    var rules;
    try {
      rules = styleSheet ? styleSheet.cssRules : undefined;
    } catch (err) {
    }
    if (!rules || rules.length === 0) {
      return;
    }

    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      switch (rule.type) {
        case window.CSSRule.CHARSET_RULE:
          continue;
        case window.CSSRule.IMPORT_RULE:
          result.push({
            index: i,
            element: element,
            rule: rule,
            parentStyleSheet: rule.parentStyleSheet,
            href: rule.href
          });
          recursiveCollectImports(element, rule.styleSheet, result);
          break;
        default:
          break;
      }
    }
  }
}
