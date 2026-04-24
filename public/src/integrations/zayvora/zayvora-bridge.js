(function (global) {
  'use strict';

  function normalizePrompt(prompt) {
    return String(prompt || '').trim().replace(/\s+/g, ' ');
  }

  function scoreIntent(tokens, keywords) {
    return keywords.reduce(function (score, keyword) {
      return score + (tokens.indexOf(keyword) >= 0 ? 1 : 0);
    }, 0);
  }

  function inferPrimaryIntent(prompt) {
    var normalized = normalizePrompt(prompt).toLowerCase();
    var tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);
    var intents = [
      { name: 'support', words: ['support', 'ticket', 'helpdesk', 'issue', 'customer'] },
      { name: 'commerce', words: ['order', 'cart', 'checkout', 'payment', 'refund'] },
      { name: 'onboarding', words: ['onboard', 'welcome', 'signup', 'trial', 'activation'] },
      { name: 'security', words: ['security', 'risk', 'fraud', 'alert', 'incident'] }
    ];

    var winner = intents.reduce(function (best, current) {
      var nextScore = scoreIntent(tokens, current.words);
      if (nextScore > best.score) {
        return { name: current.name, score: nextScore };
      }

      return best;
    }, { name: 'general', score: 0 });

    return winner.name;
  }

  function detectEntities(prompt) {
    var normalized = normalizePrompt(prompt);
    var actionMatches = normalized.match(/\b(send|notify|create|route|update|fetch|check|review|log)\b/gi) || [];
    var dataMatches = normalized.match(/\b(ticket|customer|order|account|email|message|incident|record)\b/gi) || [];

    return {
      actions: actionMatches.map(function (item) { return item.toLowerCase(); }),
      resources: dataMatches.map(function (item) { return item.toLowerCase(); })
    };
  }

  function reasonOverPrompt(prompt) {
    var normalized = normalizePrompt(prompt);
    return {
      prompt: normalized,
      confidence: normalized.length > 24 ? 0.88 : 0.71,
      intent: inferPrimaryIntent(normalized),
      entities: detectEntities(normalized)
    };
  }

  function generateWorkflowFromPrompt(prompt) {
    var reasoning = reasonOverPrompt(prompt);
    var interpreter = global.LogicHubTaskInterpreter;
    var generator = global.LogicHubWorkflowGenerator;

    if (!interpreter || !generator) {
      throw new Error('Zayvora integration dependencies are missing.');
    }

    var structuredTask = interpreter.interpretReasoning(reasoning);
    return generator.generateWorkflow(structuredTask);
  }

  global.LogicHubZayvoraBridge = {
    reasonOverPrompt: reasonOverPrompt,
    generateWorkflowFromPrompt: generateWorkflowFromPrompt
  };
})(window);
