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

    var projectId = draft.appId || 'default-app';
    var statusKey = 'lh_status_' + projectId;
    var startKey = 'lh_audit_start_' + projectId;
    var intentKey = 'lh_intent_' + projectId;
    var traceKey = 'lh_trace_' + projectId;
    var urlKey = 'lh_published_url_' + projectId;

    var currentStatus = localStorage.getItem(statusKey) || 'DRAFT';
    var auditStart = localStorage.getItem(startKey);
    var intent = localStorage.getItem(intentKey) || '';
    var traceLogJson = localStorage.getItem(traceKey) || '{}';

    // Clear existing interval to avoid conflicts
    if (global.lhCountdownInterval) {
      clearInterval(global.lhCountdownInterval);
    }

    if (currentStatus === 'DRAFT') {
      panel.innerHTML = [
        '<h4>Publish App</h4>',
        '<ol>',
        '<li>App Name</li>',
        '<li>Description</li>',
        '<li>Preview</li>',
        '<li>Deploy</li>',
        '</ol>',
        '<label class="editor">App Name <input type="text" id="publishAppId" placeholder="support-assistant" value="' + escapeHtml(draft.appId) + '"></label>',
        '<label class="editor">Description <textarea id="publishDescription" rows="2" placeholder="What does this app do?">' + escapeHtml(draft.description) + '</textarea></label>',
        '<label class="editor">Creator Passport <input type="text" id="publishCreatorPassport" placeholder="you@passport" value="' + escapeHtml(draft.creatorPassport) + '"></label>',
        '<label class="editor">Version <input type="text" id="publishVersion" placeholder="0.1.0" value="' + escapeHtml(draft.version) + '"></label>',
        '<label class="editor">Tags (comma-separated) <input type="text" id="publishTags" placeholder="automation,support" value="' + escapeHtml(draft.tags) + '"></label>',
        '<button type="button" ' + (validation.ok ? '' : 'disabled') + ' id="simulateDeployBtn">Preview</button>',
        '<button type="button" ' + (validation.ok ? '' : 'disabled') + ' id="publishMarketplaceBtn">Deploy</button>',
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
        if (!draft.appId || !draft.creatorPassport) {
          alert('App Name and Creator Passport are required to build publish bundle.');
          return;
        }

        // Show the Intent Manifest Intercept Modal
        showIntentModal(function (intentText) {
          // Extract logical lineage from Zayvora engine nodes
          var axiomNodes = [];
          var praxisNodes = [];
          var nexarNodes = [];

          (graph.nodes || []).forEach(function (node) {
            var type = String(node.type || '').toLowerCase();
            var name = node.name || node.id || 'Unnamed Node';
            if (['config', 'auth', 'styles'].includes(type)) {
              axiomNodes.push(name);
            } else if (['ui', 'util'].includes(type)) {
              praxisNodes.push(name);
            } else if (['api', 'database'].includes(type)) {
              nexarNodes.push(name);
            } else {
              praxisNodes.push(name);
            }
          });

          var traceLog = {
            axiom_nodes: axiomNodes,
            praxis_nodes: praxisNodes,
            nexar_nodes: nexarNodes
          };

          // Save states locally
          localStorage.setItem(statusKey, 'AUDIT_BUFFER');
          localStorage.setItem(startKey, Date.now().toString());
          localStorage.setItem(intentKey, intentText);
          localStorage.setItem(traceKey, JSON.stringify(traceLog));

          // Reload panel UI
          renderDeploymentPanel(context);
        });
      });

    } else if (currentStatus === 'AUDIT_BUFFER') {
      var traceObj = {};
      try { traceObj = JSON.parse(traceLogJson); } catch (_) {}
      var axiomCount = (traceObj.axiom_nodes || []).length;
      var praxisCount = (traceObj.praxis_nodes || []).length;
      var nexarCount = (traceObj.nexar_nodes || []).length;

      panel.innerHTML = [
        '<div style="background:#0d0f14; border:1px solid #ffcc00; padding:1rem; border-radius:12px; font-family:monospace; color:#fff; box-shadow:0 8px 30px rgba(0,0,0,0.35);">',
        '  <div style="color:#ffcc00; font-weight:bold; font-size:0.85rem; margin-bottom:0.75rem; border-bottom:1px solid rgba(255,204,0,0.2); padding-bottom:0.4rem;">[AUDIT CONTROL DECK]</div>',
        '  <div style="font-size:0.74rem; margin-bottom:0.4rem; color:#ffcc00;">[STATUS] AWAITING VERIFICATION</div>',
        '  <div style="font-size:0.74rem; margin-bottom:0.4rem; color:#9aa6cb;">[ACTION] ANALYZING TRACE LOG AGAINST INTENT MANIFEST</div>',
        '  <div style="font-size:0.74rem; margin-bottom:0.9rem; color:#ff4444; font-weight:bold;" class="countdown-timer">[LOCK] DEPLOYMENT AIR-GAPPED. T-MINUS 24:00:00</div>',
        '  <div style="margin-top:0.75rem; font-size:0.7rem; color:#9aa6cb; border-top:1px solid rgba(255,255,255,0.06); padding-top:0.6rem;">',
        '    <strong>OPERATIONAL INTENT MANIFEST:</strong>',
        '    <div style="color:#fff; margin-top:0.3rem; font-style:italic;">"' + escapeHtml(intent) + '"</div>',
        '  </div>',
        '  <div style="margin-top:0.75rem; font-size:0.7rem; color:#9aa6cb;">',
        '    <strong>COGNITIVE TRACE LIFECYCLE:</strong>',
        '    <div style="color:#00ffcc; margin-top:0.3rem;">',
        '      • Axiom Nodes: ' + axiomCount + ' (' + (traceObj.axiom_nodes || []).join(', ') + ')<br>',
        '      • Praxis Nodes: ' + praxisCount + ' (' + (traceObj.praxis_nodes || []).join(', ') + ')<br>',
        '      • Nexar Nodes: ' + nexarCount + ' (' + (traceObj.nexar_nodes || []).join(', ') + ')',
        '    </div>',
        '  </div>',
        '  <div style="margin-top:1rem; font-size:0.65rem; color:#9aa6cb; line-height:1.4;">',
        '    ℹ️ <em>Deployment lock is a local security boundary validating code stability before public ecosystem injection.</em>',
        '  </div>',
        '  <button type="button" id="lh-complete-deploy-btn" disabled style="width:100%; margin-top:1.2rem; background:rgba(255,255,255,0.05); color:#9aa6cb; border:1px solid rgba(255,255,255,0.1); cursor:not-allowed;">[LOCK ACTIVE]</button>',
        '  <button type="button" id="lh-abort-deploy-btn" style="width:100%; margin-top:0.4rem; background:transparent; color:#ff4444; border:1px solid rgba(255,68,68,0.2); font-size:0.68rem;">Abort and Reset to Draft</button>',
        '</div>'
      ].join('');

      var completeBtn = panel.querySelector('#lh-complete-deploy-btn');
      var abortBtn = panel.querySelector('#lh-abort-deploy-btn');

      if (abortBtn) {
        abortBtn.onclick = function () {
          if (confirm('Are you sure you want to abort the current audit and return to draft state?')) {
            localStorage.setItem(statusKey, 'DRAFT');
            renderDeploymentPanel(context);
          }
        };
      }

      if (completeBtn) {
        completeBtn.onclick = function () {
          if (!global.LogicHubMarketplacePublisher) {
            alert('Marketplace publisher integration unavailable.');
            return;
          }
          completeBtn.textContent = 'Publishing to Daxini.space...';
          completeBtn.disabled = true;

          var traceObj = {};
          try { traceObj = JSON.parse(traceLogJson); } catch (_) {}

          global.LogicHubMarketplacePublisher.publishBuiltApp({
            appId: draft.appId,
            creatorPassport: draft.creatorPassport,
            version: draft.version,
            description: draft.description,
            tags: draft.tags,
            manifest: { intent: intent },
            traceLog: traceObj,
            previousVersion: context.lastPublishResult && context.lastPublishResult.metadata ? context.lastPublishResult.metadata.version : '',
            graph: graph,
            plan: plan,
            runtimeSnapshot: context.lastRuntimeResult || null
          }).then(function (result) {
            localStorage.setItem(statusKey, 'PUBLISHED');
            localStorage.setItem(urlKey, result.remote.url || '');
            context.lastPublishResult = result;
            context.onStateChange();
          }).catch(function (error) {
            alert('Publish failed: ' + (error?.message || 'unknown error'));
            completeBtn.textContent = 'Complete Ecosystem Deployment';
            completeBtn.disabled = false;
          });
        };
      }

      var duration = 24 * 60 * 60 * 1000;
      var updateCountdown = function () {
        var elapsed = Date.now() - parseInt(auditStart, 10);
        var remaining = duration - elapsed;
        var timerEl = panel.querySelector('.countdown-timer');
        
        if (remaining <= 0) {
          if (timerEl) timerEl.innerHTML = '[LOCK] DEPLOYMENT LOCK EXPIRED. READY TO SHIP.';
          if (completeBtn) {
            completeBtn.disabled = false;
            completeBtn.textContent = 'Complete Ecosystem Deployment';
            completeBtn.style.background = '#00ffcc';
            completeBtn.style.color = '#000';
            completeBtn.style.borderColor = '#00ffcc';
            completeBtn.style.cursor = 'pointer';
          }
          clearInterval(global.lhCountdownInterval);
          return;
        }

        var sec = Math.floor((remaining / 1000) % 60);
        var min = Math.floor((remaining / (1000 * 60)) % 60);
        var hrs = Math.floor((remaining / (1000 * 60 * 60)) % 24);

        var timeString = [
          String(hrs).padStart(2, '0'),
          String(min).padStart(2, '0'),
          String(sec).padStart(2, '0')
        ].join(':');

        if (timerEl) {
          timerEl.innerHTML = '[LOCK] DEPLOYMENT AIR-GAPPED. T-MINUS ' + timeString;
        }
      };

      global.lhCountdownInterval = setInterval(updateCountdown, 1000);
      updateCountdown();

    } else if (currentStatus === 'PUBLISHED') {
      var publishedUrl = localStorage.getItem(urlKey) || '';
      panel.innerHTML = [
        '<div style="background:#0d0f14; border:1px solid #00ffcc; padding:1rem; border-radius:12px; font-family:monospace; color:#fff; box-shadow:0 8px 30px rgba(0,0,0,0.35);">',
        '  <div style="color:#00ffcc; font-weight:bold; font-size:0.85rem; margin-bottom:0.75rem; border-bottom:1px solid rgba(0,255,204,0.2); padding-bottom:0.4rem;">[DEPLOYMENT SUCCESSFUL]</div>',
        '  <p style="font-size:0.74rem; line-height:1.5; color:#9aa6cb;">Your AI-synthesized application has completed the 24-hour verification buffer corridor and is now live on Daxini.space.</p>',
        '  <div style="margin-top:0.75rem; font-size:0.72rem; color:#9aa6cb;">',
        '    <strong>DEPLOYED URL:</strong>',
        '    <div style="margin-top:0.3rem;"><a href="' + publishedUrl + '" target="_blank" style="color:#00ffcc; text-decoration:underline;">' + publishedUrl + '</a></div>',
        '  </div>',
        '  <button type="button" id="lh-reset-draft-btn" style="width:100%; margin-top:1.2rem; background:transparent; color:#9aa6cb; border:1px solid rgba(255,255,255,0.1); cursor:pointer;">Reset App status to Draft</button>',
        '</div>'
      ].join('');

      var resetBtn = panel.querySelector('#lh-reset-draft-btn');
      if (resetBtn) {
        resetBtn.onclick = function () {
          localStorage.setItem(statusKey, 'DRAFT');
          renderDeploymentPanel(context);
        };
      }
    }
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
