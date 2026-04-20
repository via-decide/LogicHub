(function (global) {
  function bindTopToolbarButtons() {
    const bind = (id, action) => {
      const button = document.getElementById(id);
      if (button) button.addEventListener('click', action);
    };

    bind('btn-toolbar-generate', function () {
      if (global.app?.synthesizeArchitecture) global.app.synthesizeArchitecture();
    });
    bind('btn-toolbar-export', function () {
      if (global.app?.exportZip) global.app.exportZip();
    });
    bind('btn-toolbar-publish', function () {
      if (global.app?.publishApp) global.app.publishApp();
    });
  }

  function syncToolbarButtonState() {
    const hasBlocks = !!(global.app?.map?.blocks?.length);
    ['btn-toolbar-export', 'btn-toolbar-publish'].forEach((id) => {
      const button = document.getElementById(id);
      if (button) button.disabled = !hasBlocks;
    });
  }

  async function publishCurrentApp(app) {
    if (!global.LogicHubDeployClient) throw new Error('Deploy client not loaded.');
    const appName = document.getElementById('forge-app-name').value.trim() || prompt('App name for publishing?', app.getProjectDisplayName()) || '';
    if (!appName.trim()) return null;

    const { bundle, slug, metadata } = global.LogicHubDeployClient.buildPublishBundle(app, appName);
    const response = await fetch('/api/publish-endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appName, slug, bundle, metadata })
    });

    const data = await app.readJsonResponse(response, 'Publish');
    if (!response.ok || data.error) throw new Error(data.error || `Publish failed with status ${response.status}`);
    return data;
  }

  global.LogicHubPublish = {
    bindTopToolbarButtons,
    syncToolbarButtonState,
    publishCurrentApp
  };

  document.addEventListener('DOMContentLoaded', function () {
    bindTopToolbarButtons();
    syncToolbarButtonState();
  });
})(window);
