var URL = require('./url');
var qs = require('query-string');
var getLocalStylesheets = require('./getLocalStylesheets');
var stylesheets;

module.exports.page = reloadPage;
module.exports.css = reloadCSS;

function reloadPage () {
  window.location.reload(true);
}

function getStyles () {
  if (!stylesheets) {
    stylesheets = getLocalStylesheets();
  }
  return stylesheets;
}

function reloadCSS (url) {
  var styles = getStyles();
  var stylesToReload;

  if (url) {
    // Try to reload matching styles
    var key = URL.key(url);
    stylesToReload = styles.filter(function (style) {
      return style.key === key;
    });
  }

  if (!stylesToReload || stylesToReload.length === 0) {
    // No matched URLs... just reload all
    stylesToReload = styles;
  }

  // reload each style
  stylesToReload.forEach(function (style) {
    reloadStyleSheet(style);
  });
}

function bustSheet (styleSheet) {
  
}

function reloadStyleSheet (style) {
  // TODO: de-duplicate root sheets into a single list
  var rootSheet = getStyleSheetRoot(style.link
    ? (style.link.sheet||style.sheet)
    : style.imported.parentStyleSheet);

  console.log('needs update', style);
  if (rootSheet && rootSheet.href && rootSheet.ownerNode && rootSheet.ownerNode.tagName === 'LINK') {
    console.log('update link');
    var newHref = getCacheBustUrl(rootSheet.href);
    var link = rootSheet.ownerNode;

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
      // recursively cache bust all URLs in this sheet
      recursiveCacheBustImportRules(cloned.sheet);
      cloned.sheet.ownerNode = cloned;
      style.link = cloned;
      style.sheet = cloned.sheet;
    };
    // Update the href to the new URL.
    cloned.href = newHref;
  } else if (rootSheet) {
    console.log('update style');
    // we can just cache bust the imports in this <style> tag
    recursiveCacheBustImportRules(rootSheet);
  }
}

function getStyleSheetRoot (styleSheet) {
  var parent = styleSheet;
  while (parent) {
    var newParent = parent.parentStyleSheet;
    if (!newParent) break;
    parent = newParent;
  }
  return parent;
}

function recursiveCacheBustImportRules (styleSheet) {
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
        cacheBustImportRule(rule, i);
        recursiveCacheBustImportRules(rule.styleSheet);
        break;
      default:
        break;
    }
  }
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

  var newRule = '@import url("' + newHref + '") ' + media + ';';
  parent.insertRule(newRule, index);
  parent.deleteRule(index + 1);
  return parent.cssRules[index];
}

function reloadStyleSheet2 (style) {
  // get new cache busted href
  var newHref = getCacheBustUrl(style.href);
  if (style.imported) {
    updateImportedStyleSheet(style);
  } else {
    var link = style.link;
    link.href = newHref;
    // var cloned = link.cloneNode(false);
    // cloned.href = '';

    // var parent = link.parentNode;
    // if (parent.lastChild === link) {
    //   parent.appendChild(cloned);
    // } else {
    //   parent.insertBefore(cloned, link.nextSibling);
    // }
    // cloned.onload = function () {
    //   console.log('css loaded', cloned.sheet);
    //   if (link.parentNode) link.parentNode.removeChild(link);
    //   style.link = cloned;

    //   var styles = getLocalStylesheets();
    //   var importedStyles = styles.filter(function (other) {
    //     return other.imported && other.parentKey === style.key;
    //   });
    //   importedStyles.forEach(function (other) {
    //     updateImportedStyleSheet(other);
    //   });
    // };
    // Update the href to the new URL.
    // cloned.href = newHref;
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

function updateImportedStyleSheet (style) {
  var imported = style.imported;
  var rule = imported.rule;
  var index = imported.index;
  var parent = imported.parentStyleSheet;
  var newHref = getCacheBustUrl(style.href);

  var media = '';
  try {
    media = rule.media.length
      ? Array.prototype.join.call(rule.media, ', ')
      : '';
  } catch (err) {
    // might get here if permission is denied for some reason
  }

  var newRule = '@import url("' + newHref + '") ' + media + ';';
  parent.insertRule(newRule, index);
  parent.deleteRule(index + 1);
  imported.rule = parent.cssRules[index];
}

/*

  URL is changed:
  
  - URL is reloaded
    - If URL is a <link>, set href to new url
    - If URL 


 */