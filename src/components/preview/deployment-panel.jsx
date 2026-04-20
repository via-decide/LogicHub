(function (global) {
  'use strict';

  function renderDeploymentPanel(context) {
    var panel = context.deploymentPanel;
    var graph = { nodes: context.state.nodes, edges: context.state.edges };
    var parsed = global.LogicHubWorkflowParser.parseGraph(graph);
    var validation = global.LogicHubExecutionValidator.validatePlan(parsed);
    var plan = validation.ok ? global.LogicHubNodeCompiler.compile(parsed) : null;

    panel.innerHTML = [
      '<ul>',
      '<li><strong>Nodes:</strong> ' + context.state.nodes.length + '</li>',
      '<li><strong>Connections:</strong> ' + context.state.edges.length + '</li>',
      '<li><strong>Status:</strong> ' + (validation.ok ? 'Executable' : validation.issues[0]) + '</li>',
      '</ul>',
      '<button type="button" ' + (validation.ok ? '' : 'disabled') + ' id="simulateDeployBtn">Simulate Deploy</button>',
      '<p class="lh-footnote">Compiles your graph into an execution plan and runs it through the workflow runtime.</p>'
    ].join('');

    var simulateButton = panel.querySelector('#simulateDeployBtn');
    if (simulateButton) simulateButton.addEventListener('click', function () {
      simulateButton.textContent = 'Running...'; simulateButton.disabled = true;
      global.LogicHubWorkflowRuntime.run(plan, context.runtimeHandlers, { source: 'studio' }).then(function (result) {
        context.lastRuntimeResult = result;
        simulateButton.textContent = 'Deployment Planned (' + result.logs.length + ' steps)';
        context.onStateChange();
      });
    });
  }

  global.LogicHubStudioDeploy = { renderDeploymentPanel: renderDeploymentPanel };
})(window);
