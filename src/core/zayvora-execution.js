(function (global) {
  'use strict';
  var zContext = { state: {}, memory: {}, logs: [], verification: [] };
  function verifyOutput(output) { return output ? { valid: true, confidence: 0.9 } : { valid: false, confidence: 0 }; }
  function runZayvoraPipeline(actions, context, runner) {
    var ordered = Array.isArray(actions) ? actions : [];
    var cursor = Promise.resolve();
    ordered.forEach(function (action) {
      cursor = cursor.then(function () { return runner(action).then(function (output) {
        context.memory[action.id || action.type || 'node'] = output;
        var verified = verifyOutput(output);
        context.verification.push({ nodeId: action.id, valid: verified.valid, confidence: verified.confidence });
        context.logs.push({ nodeId: action.id, output: output, verified: verified });
        if (!verified.valid) throw new Error('Verification failed');
      }); });
    });
    return cursor.then(function () { return context; });
  }
  global.LogicHubZayvoraExecution = { zContext: zContext, verifyOutput: verifyOutput, runZayvoraPipeline: runZayvoraPipeline };
})(window);
