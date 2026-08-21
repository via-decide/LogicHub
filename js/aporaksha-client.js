(function() {
  'use strict';

  var BRIDGE_URL = 'https://aporaksha.com/passport/sso-bridge.html';
  var SESSION_KEY = 'zayvora_passport_session_v1';
  var BRIDGE_TIMEOUT_MS = 3000;

  function AporakshaClient() {
    this.iframe = null;
    this.ready = false;
    this._pending = {};
    this._init();
  }

  AporakshaClient.prototype._init = function() {
    if (document.getElementById('aporaksha-sso-bridge')) return;

    this.iframe = document.createElement('iframe');
    this.iframe.id = 'aporaksha-sso-bridge';
    this.iframe.src = BRIDGE_URL;
    this.iframe.style.display = 'none';
    this.iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.iframe);

    var self = this;

    window.addEventListener('message', function(event) {
      var bridgeOrigin = new URL(BRIDGE_URL).origin;
      if (event.origin !== bridgeOrigin) return;

      var data = event.data;
      if (!data || data.type !== 'SSO_RESPONSE') return;

      var pendingKey = data.action + '_' + data.key;
      if (self._pending[pendingKey]) {
        self._pending[pendingKey](data.value || data.success);
        delete self._pending[pendingKey];
      }
    });

    this.iframe.onload = function() {
      self.ready = true;
    };
  };

  AporakshaClient.prototype._waitReady = function() {
    if (this.ready) return Promise.resolve();
    var self = this;
    return new Promise(function(resolve) {
      var check = setInterval(function() {
        if (self.ready) {
          clearInterval(check);
          resolve();
        }
      }, 50);
    });
  };

  AporakshaClient.prototype.getSessionToken = function() {
    var self = this;
    return this._waitReady().then(function() {
      return new Promise(function(resolve) {
        self._pending['get_' + SESSION_KEY] = function(val) {
          resolve(val ? JSON.parse(val) : null);
        };
        self.iframe.contentWindow.postMessage({ action: 'get', key: SESSION_KEY }, '*');

        setTimeout(function() {
          if (self._pending['get_' + SESSION_KEY]) {
            resolve(null);
            delete self._pending['get_' + SESSION_KEY];
          }
        }, BRIDGE_TIMEOUT_MS);
      });
    });
  };

  AporakshaClient.prototype.requireAuth = function(redirectUrl) {
    var url = redirectUrl || window.location.href;
    return this.getSessionToken().then(function(session) {
      if (!session || !session.token) {
        window.location.href = 'https://aporaksha.com/passport/index.html?redirect=' + encodeURIComponent(url);
        return null;
      }
      return session;
    });
  };

  AporakshaClient.prototype.logout = function() {
    var self = this;
    return this._waitReady().then(function() {
      return new Promise(function(resolve) {
        self._pending['clear_undefined'] = function() { resolve(true); };
        self.iframe.contentWindow.postMessage({ action: 'clear' }, '*');
        setTimeout(function() { resolve(false); }, BRIDGE_TIMEOUT_MS);
      });
    });
  };

  window.Aporaksha = new AporakshaClient();
})();
