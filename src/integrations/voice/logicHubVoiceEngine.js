(function (global) {
  'use strict';

  function createVoiceEngine(options) {
    var SpeechRecognition = global.SpeechRecognition || global.webkitSpeechRecognition;
    var listeners = {
      transcript: options.onTranscript,
      status: options.onStatus,
      error: options.onError
    };

    if (!SpeechRecognition) {
      return {
        supported: false,
        listening: false,
        start: function () {
          if (typeof listeners.error === 'function') listeners.error('Speech recognition is not supported in this browser.');
        },
        stop: function () {}
      };
    }

    var recognition = new SpeechRecognition();
    recognition.lang = options.lang || 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    var listening = false;

    recognition.onstart = function () {
      listening = true;
      if (typeof listeners.status === 'function') listeners.status('listening');
    };

    recognition.onresult = function (event) {
      var result = event && event.results && event.results[0] && event.results[0][0];
      var transcript = result ? result.transcript : '';
      if (typeof listeners.transcript === 'function') listeners.transcript(transcript);
    };

    recognition.onerror = function (event) {
      if (typeof listeners.error === 'function') {
        listeners.error(event && event.error ? event.error : 'Unknown speech recognition error.');
      }
    };

    recognition.onend = function () {
      listening = false;
      if (typeof listeners.status === 'function') listeners.status('idle');
    };

    return {
      supported: true,
      get listening() {
        return listening;
      },
      start: function () {
        if (listening) return;
        recognition.start();
      },
      stop: function () {
        if (!listening) return;
        recognition.stop();
      }
    };
  }

  global.LogicHubVoiceEngine = {
    createVoiceEngine: createVoiceEngine
  };
})(window);
