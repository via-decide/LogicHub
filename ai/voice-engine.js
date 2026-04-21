(function (global) {
  'use strict';

  function createVoiceEngine(options) {
    var source = global.LogicHubVoiceEngine;
    if (source && typeof source.createVoiceEngine === 'function') {
      return source.createVoiceEngine(options || {});
    }

    var Recognition = global.SpeechRecognition || global.webkitSpeechRecognition;
    if (!Recognition) {
      return {
        supported: false,
        listening: false,
        start: function () {
          if (options && typeof options.onError === 'function') options.onError('Speech recognition is not supported in this browser.');
        },
        stop: function () {}
      };
    }

    var recognition = new Recognition();
    recognition.lang = (options && options.lang) || 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    var listening = false;
    recognition.onstart = function () { listening = true; if (options && options.onStatus) options.onStatus('listening'); };
    recognition.onend = function () { listening = false; if (options && options.onStatus) options.onStatus('idle'); };
    recognition.onerror = function (event) { if (options && options.onError) options.onError((event && event.error) || 'voice error'); };
    recognition.onresult = function (event) {
      var result = event && event.results && event.results[0] && event.results[0][0];
      if (options && options.onTranscript) options.onTranscript(result ? result.transcript : '');
    };

    return {
      supported: true,
      get listening() { return listening; },
      start: function () { if (!listening) recognition.start(); },
      stop: function () { if (listening) recognition.stop(); }
    };
  }

  global.LogicHubBuilderVoiceEngine = { createVoiceEngine: createVoiceEngine };
})(window);
