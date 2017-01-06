var reloader = require('./lib/reloader');

connect();

function connect () {
  var reconnectPoll = 1000;
  var maxRetries = 50;
  var retries = 0;
  var reconnectInterval;
  var isReconnecting = false;
  var protocol = document.location.protocol;
  var hostname = document.location.hostname;
  var port = document.location.port;
  var host = hostname + ':' + port;

  var isIOS = /(iOS|iPhone|iPad|iPod)/i.test(navigator.userAgent);
  var isSSL = /^https:/i.test(protocol);
  createWebSocket();

  function scheduleReconnect () {
    if (isIOS && isSSL) {
      // Special case for iOS with a self-signed certificate - we need
      // to fall back to XHR polling.
      console.warn('[budo] LiveReload disconnected. You may need to generate and ' +
        'trust a self-signed certificate, see here:\n' +
        'https://github.com/mattdesl/budo/blob/master/docs/' +
        'command-line-usage.md#ssl-on-ios');
      return;
    }
    if (isSSL) {
      // Don't attempt to re-connect in SSL since it will likely be insecure
      console.warn('[budo] LiveReload disconnected. Please reload the page to retry.');
      return;
    }
    if (retries >= maxRetries) {
      console.warn('[budo] LiveReload disconnected, exceeded retry count. Please reload the page to retry.');
      return;
    }
    if (!isReconnecting) {
      isReconnecting = true;
      console.warn('[budo] LiveReload disconnected, retrying...');
    }
    retries++;
    clearTimeout(reconnectInterval);
    reconnectInterval = setTimeout(reconnect, reconnectPoll);
  }

  function reconnect () {
    createWebSocket();
  }

  function createWebSocket () {
    var wsProtocol = isSSL ? 'wss://' : 'ws://';
    var wsUrl = wsProtocol + host + '/livereload';
    var ws = new window.WebSocket(wsUrl);
    var count = 0;
    ws.onmessage = function (event) {
      var url = event.data;
      if (url && typeof url === 'string') {
        reloader.css(url);
      } else {
        reloader.page();
      }
    };
    ws.onclose = function (ev) {
      if (ev.code === 1000 || ev.code === 1001) {
        // Browser is navigating away.
        return;
      }
      scheduleReconnect();
    };
    ws.onopen = function () {
      if (isReconnecting) {
        isReconnecting = false;
        console.warn('[budo] LiveReload reconnected.');
      }
    };
    ws.onerror = function () {
      return false;
    };
    return ws;
  }
}

