(function (global) {
  'use strict';

  function createComponentLoader(registry) {
    var components = Object.assign({}, registry || {});

    function register(type, renderer) {
      components[type] = renderer;
    }

    function render(node, context) {
      var renderer = components[node.type] || components.default;
      if (!renderer) throw new Error('Missing renderer for component type: ' + node.type);
      return Promise.resolve(renderer(node, context));
    }

    return { register: register, render: render };
  }

  global.LogicHubComponentLoader = { create: createComponentLoader };
})(window);
