(function (global) {
  'use strict';

  function normalizePrompt(prompt) {
    return String(prompt || '').trim().replace(/\s+/g, ' ');
  }

  function containsWord(tokens, words) {
    return words.some(function (word) {
      return tokens.indexOf(word) >= 0;
    });
  }

  function parseIntent(prompt) {
    var normalized = normalizePrompt(prompt);
    var tokens = normalized.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

    var category = 'general';
    if (containsWord(tokens, ['restaurant', 'food', 'menu', 'order'])) category = 'restaurant';
    if (containsWord(tokens, ['ecommerce', 'shop', 'cart', 'product'])) category = 'commerce';

    var features = [];
    if (containsWord(tokens, ['menu', 'catalog'])) features.push('menu');
    if (containsWord(tokens, ['cart', 'basket', 'ordering', 'order'])) features.push('cart');
    if (containsWord(tokens, ['checkout', 'payment', 'pay'])) features.push('checkout');
    if (containsWord(tokens, ['login', 'auth', 'signin'])) features.push('login');
    if (containsWord(tokens, ['search', 'find'])) features.push('search');
    if (containsWord(tokens, ['track', 'tracking'])) features.push('tracking');

    var type = containsWord(tokens, ['add', 'create']) ? 'create_or_update_app' : 'update_app';

    return {
      type: type,
      category: category,
      features: Array.from(new Set(features)),
      prompt: normalized
    };
  }

  global.LogicHubAIIntentParser = {
    parseIntent: parseIntent
  };
})(window);
