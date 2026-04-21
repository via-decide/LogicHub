(function (global) {
  'use strict';

  function ensureFeature(list, item) {
    if (list.indexOf(item) < 0) list.push(item);
  }

  function buildPlan(intent) {
    var features = (intent.features || []).slice();
    var pages = ['Home'];
    var components = [];
    var schema = [];
    var workflows = [];

    if (intent.category === 'restaurant') {
      ensureFeature(features, 'menu');
      ensureFeature(features, 'cart');
      ensureFeature(features, 'checkout');
      schema.push('menu_items', 'orders', 'customers');
      workflows.push('add_to_cart', 'checkout');
    }

    features.forEach(function (feature) {
      if (feature === 'menu') {
        if (pages.indexOf('Menu') < 0) pages.push('Menu');
        components.push('Menu List');
      }
      if (feature === 'cart') {
        if (pages.indexOf('Cart') < 0) pages.push('Cart');
        components.push('Cart Widget');
      }
      if (feature === 'checkout') {
        if (pages.indexOf('Checkout') < 0) pages.push('Checkout');
        components.push('Order Form');
      }
      if (feature === 'login') {
        pages.push('Login');
        components.push('Login Form');
      }
      if (feature === 'search') {
        components.push('Search Bar');
      }
      if (feature === 'tracking') {
        pages.push('Order Tracking');
        components.push('Tracking Timeline');
      }
    });

    return {
      intent: intent,
      pages: Array.from(new Set(pages)),
      components: Array.from(new Set(components)),
      dataSchema: Array.from(new Set(schema)),
      workflows: Array.from(new Set(workflows)),
      integrations: {
        supabase: intent.prompt.toLowerCase().indexOf('supabase') >= 0,
        stripe: intent.prompt.toLowerCase().indexOf('payment') >= 0 || intent.prompt.toLowerCase().indexOf('stripe') >= 0
      },
      generatedAt: new Date().toISOString()
    };
  }

  function planToNodes(plan, state) {
    var nodeId = state.idCounter;
    var nodes = [];
    var edges = [];

    function pushNode(type, title, description, x, y) {
      nodeId += 1;
      var id = 'node-' + nodeId;
      nodes.push({ id: id, type: type, title: title, description: description, x: x, y: y });
      return id;
    }

    var rootId = pushNode('Trigger', 'AI Builder Command', plan.intent.prompt, 24, 24);
    var prevId = rootId;

    plan.pages.forEach(function (page, index) {
      var id = pushNode('UI Generator', 'Page: ' + page, 'Auto generated page', 24 + (index % 3) * 220, 160 + Math.floor(index / 3) * 130);
      edges.push({ from: prevId, to: id });
      prevId = id;
    });

    plan.workflows.forEach(function (workflow, index) {
      var id = pushNode('Action', 'Workflow: ' + workflow, 'Auto generated workflow', 24 + (index % 3) * 220, 420 + Math.floor(index / 3) * 130);
      edges.push({ from: rootId, to: id });
    });

    return { nodes: nodes, edges: edges, nextIdCounter: nodeId };
  }

  global.LogicHubAIAppGenerator = {
    buildPlan: buildPlan,
    planToNodes: planToNodes
  };
})(window);
