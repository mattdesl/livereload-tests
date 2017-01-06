var qs = require('query-string');
var URL = require('./url');

// Reference:
// https://github.com/andrewdavey/vogue/
// module.exports = getLocalStylesheets;
// function getLocalStylesheets () {
//   var baseHosts = getBaseHosts();
//   var results = [];
//   var links = elements('link');
//   var imports = [];

//   // Look for local <link> tags
//   links.forEach(function (link) {
//     if (isPrintMedia(link) || !isLocalStylesheet(link)) {
//       return;
//     }

//     // Find any @import tags
//     recursiveCollectImports(link, link.sheet, imports);

//     var href = link.getAttribute('href');
//     var key = URL.key(href);
//     results.push({ key: key, parent: link, link: link, href: href });
//   });

//   // Also look for @import tags in style elements
//   var styles = elements('style');
//   styles.forEach(function (style) {
//     if (isPrintMedia(style)) return;
//     recursiveCollectImports(style, style.sheet, imports);
//   });

//   imports.forEach(function (imported) {
//     var parentHref = imported.parentStyleSheet.href || document.location.href;
//     var absHref = URL.resolve(parentHref, imported.href);
//     // var parentKey = URL.key(parentHref);
//     var key = URL.key(absHref);
//     results.push({ key: key, parent: imported.parentStyleSheet, imported: imported, href: imported.href });
//   });

  

module.exports = function () {
  var baseHosts = getBaseHosts();
  return {
    update: update
  };

  function update (url) {
    // We should do this each time in case e.g.
    // deferred JS adds a link or style element.
    var nodes = [ 'link', 'style' ]
      .map(elements)
      .reduce(function (a, b) {
        return a.concat(b);
      }, [])
      .filter(filterStyleSheet)
      .map(function (el) {
        var data = {
          element: el,
          childImports: []
        };
        var href = el.getAttribute('href');
        if (el.tagName === 'LINK' && href) {
          data.key = URL.key(href);
        }
        return data;
      });

    // crawl imports
    var imports = [];
    nodes.forEach(function (node) {
      findImports(node, node.element.sheet, imports);
    });

    // STEP 1
    // for each import that matches URL
    //   bust in rule.parentStyleSheet
    //   mark this URL as "dirty" (needs bust)
    // STEP 2
    // for each link that matches URL
    //   re-attach link
    //   now bust any "dirty" URLs

    if (url) {
      var key = URL.key(url);

      // now find any imports that need busting
      // Map them to the "top most" import that needs update
      // (Chrome breaks with deep style changes)
      var matchImports = imports.filter(function (imported) {
        return imported.key === key;
      }).map(function (imported) {
        return getTopmostImport(imported);
      });

      // Filter out any potential duplicate imports
      matchImports = uniq(matchImports);

      // Bust each import from back to front
      matchImports.reverse().forEach(function (imported) {
        bust(imported);
      });

      // now find any URLs referenced by a <link> tag
      var matchLinks = nodes.filter(function (node) {
        return node.element.tagName === 'LINK' && node.key === key;
      });

      // update each link
      matchLinks.forEach(function (node) {
        // bust this <link> element AND all its child imports
        node.element = reattachLink(node.element);
      });
    }
  }

  function bust (imported) {
    if (!imported.busted) {
      imported.rule = cacheBustImportRule(imported.rule, imported.index);
    }
    imported.busted = true;
    return imported;
  }

  function reattachLink (link, cb) {
    // console.log('update link');
    // var href = link.getAttribute('href');
    // link.setAttribute('href', getCacheBustUrl(href));
    // return link;
    var href = link.getAttribute('href');
    var newHref = getCacheBustUrl(href);

    var cloned = link.cloneNode(false);
    cloned.href = '';

    var parent = link.parentNode;
    if (parent.lastChild === link) {
      parent.appendChild(cloned);
    } else {
      parent.insertBefore(cloned, link.nextSibling);
    }

    cloned.onload = function () {
      if (link.parentNode) link.parentNode.removeChild(link);
      // recursively cache bust all dirty URLs in this sheet
      if (cb) cb();
    };
    // Update the href to the new URL.
    cloned.href = newHref;
    return cloned;
  }

  function uniq (list) {
    var result = [];
    list.forEach(function (item) {
      if (result.indexOf(item) === -1) {
        result.push(item);
      }
    });
    return result;
  }

  function filterStyleSheet (element) {
    if (isPrintMedia(element)) return false;
    if (element.tagName === 'LINK' && !isLocalStylesheet(element)) return false;
    return true;
  }

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
};

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

function cacheBustImportRule (rule, index) {
  var parent = rule.parentStyleSheet;
  var newHref = getCacheBustUrl(rule.href);

  var media = '';
  try {
    media = rule.media.length
      ? Array.prototype.join.call(rule.media, ', ')
      : '';
  } catch (err) {
    // might get here if permission is denied for some reason
  }
  // console.log('busting', newHref)

  var newRule = '@import url("' + newHref + '") ' + media + ';';
  parent.insertRule(newRule, index);
  parent.deleteRule(index + 1);
  return parent.cssRules[index];
}

function getTopmostImport (imported) {
  var topmost = imported;
  while (topmost.parentImport) {
    topmost = topmost.parentImport;
  }
  return topmost;
}

function findImports (node, styleSheet, result, lastImport, depth) {
  if (!styleSheet) return;
  depth = typeof depth !== 'number' ? 1 : depth;
  var rules;
  try {
    rules = styleSheet.cssRules;
  } catch (err) {
    // some sort of security error
  }
  if (!rules || rules.length === 0) {
    return;
  }

  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];
    if (rule.type === window.CSSRule.IMPORT_RULE) {
      var parentHref = rule.parentStyleSheet.href || document.location.href;
      var href = URL.resolve(parentHref, rule.href);
      var key = URL.key(href);

      var newImport = {
        depth: depth,
        index: i,
        rootElement: node.element,
        rootElementKey: node.key,
        rule: rule,
        parentImport: lastImport,
        parentStyleSheet: rule.parentStyleSheet,
        key: key,
        href: rule.href
      };
      result.push(newImport);
      if (node.childImports.indexOf(key) === -1) {
        node.childImports.push(key);
      }
      findImports(node, rule.styleSheet, result, newImport, depth + 1);
    }
  }
}

function getCacheBustUrl (href) {
  var parsed = URL.parse(href);
  var qsObj = qs.parse(parsed.search);
  qsObj._livereload = String(Date.now());
  parsed.query = undefined;
  parsed.search = qs.stringify(qsObj);
  return URL.format(parsed);
}
