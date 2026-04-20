(function (global) {
  'use strict';

  function renderDeploymentPanel(context) {
    var panel = context.deploymentPanel;
    var nodeCount = context.state.nodes.length;
    var edgeCount = context.state.edges.length;
    var connectable = nodeCount > 1;
    var complete = nodeCount > 0 && edgeCount > 0;

    panel.innerHTML = [
      '<ul>',
      '<li><strong>Nodes:</strong> ' + nodeCount + '</li>',
      '<li><strong>Connections:</strong> ' + edgeCount + '</li>',
      '<li><strong>Status:</strong> ' + (complete ? 'Ready for deployment simulation' : 'Needs additional workflow links') + '</li>',
      '</ul>',
      '<button type="button" ' + (connectable ? '' : 'disabled') + ' id="simulateDeployBtn">Simulate Deploy</button>',
      '<p class="lh-footnote">Simulated deployment packages your visual graph as an execution plan.</p>'
    ].join('');

    var simulateButton = panel.querySelector('#simulateDeployBtn');
    if (simulateButton) {
      simulateButton.addEventListener('click', function () {
        simulateButton.textContent = 'Deployment Planned';
        simulateButton.disabled = true;
      });
    }
  }

  global.LogicHubStudioDeploy = {
    renderDeploymentPanel: renderDeploymentPanel
  };
})(window);
