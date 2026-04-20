(function (global) {
  'use strict';

  function toComponent(node, index) {
    return {
      id: node.id,
      key: 'component-' + (index + 1),
      type: node.type,
      title: node.title,
      description: node.description || '',
      props: {
        order: index + 1,
        executable: true
      }
    };
  }

  function bundle(workflow, compiledPlan, config) {
    var nodes = Array.isArray(workflow && workflow.graph && workflow.graph.nodes) ? workflow.graph.nodes : [];
    var components = nodes.map(toComponent);

    return {
      appId: config.appId,
      outputType: config.outputType,
      components: components,
      executionPlan: compiledPlan,
      manifest: {
        componentCount: components.length,
        hasRuntime: true,
        pipeline: ['workflow', 'component-compiler', 'runtime-package', 'deployable-build']
      }
    };
  }

  global.LogicHubComponentBundler = {
    bundle: bundle
  };
})(window);
