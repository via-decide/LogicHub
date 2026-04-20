(function (global) {
  'use strict';

  function renderDeploymentPanel(context) {
    var panel = context.deploymentPanel;
    var graph = { nodes: context.state.nodes, edges: context.state.edges };
    var parsed = global.LogicHubWorkflowParser.parseGraph(graph);
    var validation = global.LogicHubExecutionValidator.validatePlan(parsed);
    var plan = validation.ok ? global.LogicHubNodeCompiler.compile(parsed) : null;

    var draft = context.marketplaceDraft || (context.marketplaceDraft = {
      appId: '',
      creatorPassport: '',
      version: '',
      description: '',
      tags: ''
    });

    panel.innerHTML = [
      '<ul>',
      '<li><strong>Nodes:</strong> ' + context.state.nodes.length + '</li>',
      '<li><strong>Connections:</strong> ' + context.state.edges.length + '</li>',
      '<li><strong>Status:</strong> ' + (validation.ok ? 'Executable' : validation.issues[0]) + '</li>',
      '</ul>',
      '<button type="button" ' + (validation.ok ? '' : 'disabled') + ' id="simulateDeployBtn">Simulate Deploy</button>',
      '<p class="lh-footnote">Compiles your graph into an execution plan and runs it through the workflow runtime.</p>',
      '<hr>',
      '<h4>Publish to Daxini.space</h4>',
      '<label class="editor">App ID <input type="text" id="publishAppId" placeholder="support-assistant" value="' + escapeHtml(draft.appId) + '"></label>',
      '<label class="editor">Creator Passport <input type="text" id="publishCreatorPassport" placeholder="you@passport" value="' + escapeHtml(draft.creatorPassport) + '"></label>',
      '<label class="editor">Version <input type="text" id="publishVersion" placeholder="0.1.0" value="' + escapeHtml(draft.version) + '"></label>',
      '<label class="editor">Description <textarea id="publishDescription" rows="2" placeholder="What does this app do?">' + escapeHtml(draft.description) + '</textarea></label>',
      '<label class="editor">Tags (comma-separated) <input type="text" id="publishTags" placeholder="automation,support" value="' + escapeHtml(draft.tags) + '"></label>',
      '<button type="button" ' + (validation.ok ? '' : 'disabled') + ' id="publishMarketplaceBtn">Publish App</button>',
      '<p id="publishStatus" class="lh-footnote">' + (context.lastPublishResult ? renderPublishSummary(context.lastPublishResult) : 'Provide metadata and publish your built app to Daxini.space marketplace.') + '</p>'
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

    bindDraftInput(panel, '#publishAppId', draft, 'appId');
    bindDraftInput(panel, '#publishCreatorPassport', draft, 'creatorPassport');
    bindDraftInput(panel, '#publishVersion', draft, 'version');
    bindDraftInput(panel, '#publishDescription', draft, 'description');
    bindDraftInput(panel, '#publishTags', draft, 'tags');

    var publishButton = panel.querySelector('#publishMarketplaceBtn');
    var publishStatus = panel.querySelector('#publishStatus');
    if (publishButton) publishButton.addEventListener('click', function () {
      if (!global.LogicHubMarketplacePublisher) {
        publishStatus.textContent = 'Marketplace integration is unavailable.';
        return;
      }

      publishButton.textContent = 'Publishing...';
      publishButton.disabled = true;
      publishStatus.textContent = 'Submitting app package to Daxini.space...';

      global.LogicHubMarketplacePublisher.publishBuiltApp({
        appId: draft.appId,
        creatorPassport: draft.creatorPassport,
        version: draft.version,
        description: draft.description,
        tags: draft.tags,
        previousVersion: context.lastPublishResult && context.lastPublishResult.metadata ? context.lastPublishResult.metadata.version : '',
        graph: graph,
        plan: plan,
        runtimeSnapshot: context.lastRuntimeResult || null
      }).then(function (result) {
        context.lastPublishResult = result;
        context.onStateChange();
      }).catch(function (error) {
        publishStatus.textContent = 'Publish failed: ' + (error && error.message ? error.message : 'unknown error');
        publishButton.textContent = 'Publish App';
        publishButton.disabled = false;
      });
    });
  }

  function bindDraftInput(panel, selector, draft, key) {
    var element = panel.querySelector(selector);
    if (!element) return;
    element.addEventListener('input', function () {
      draft[key] = element.value;
    });
  }

  function renderPublishSummary(result) {
    if (!result || !result.remote) return 'Publish has not started.';
    var status = result.ok ? 'Published' : 'Publish unsuccessful';
    return status + ' v' + result.metadata.version + ' as ' + result.metadata.app_id + '. URL: ' + result.remote.url;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;');
  }

  global.LogicHubStudioDeploy = { renderDeploymentPanel: renderDeploymentPanel };
})(window);
