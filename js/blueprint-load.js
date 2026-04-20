(function (global) {
  function readBlueprintSlugFromURL() {
    const params = new URLSearchParams(location.search);
    const querySlug = params.get('blueprint');
    if (querySlug) return querySlug;

    const marker = '/b/';
    const path = location.pathname;
    const markerIndex = path.indexOf(marker);
    if (markerIndex !== -1) {
      return path.slice(markerIndex + marker.length).split('/')[0];
    }

    return '';
  }

  function renderBlueprint(blueprint) {
    if (!blueprint) return;

    const board = document.getElementById('workspaceCanvasBoard');
    if (!board) return;

    board.querySelectorAll('.workspace-node, .workspace-edge').forEach((el) => el.remove());

    (blueprint.nodes || []).forEach((node) => {
      const nodeElement = document.createElement('div');
      nodeElement.className = 'workspace-node absolute rounded-lg border border-cyan-300 bg-cyan-50 dark:bg-cyan-900/30 dark:border-cyan-700 text-xs font-medium px-3 py-2 text-slate-800 dark:text-slate-100';
      nodeElement.dataset.id = node.id;
      nodeElement.dataset.type = node.type;
      nodeElement.dataset.x = String(node.x || 0);
      nodeElement.dataset.y = String(node.y || 0);
      nodeElement.style.left = `${node.x || 0}px`;
      nodeElement.style.top = `${node.y || 0}px`;
      nodeElement.textContent = node.type;
      board.appendChild(nodeElement);
    });

    (blueprint.edges || []).forEach((edge) => {
      const edgeElement = document.createElement('div');
      edgeElement.className = 'workspace-edge hidden';
      edgeElement.dataset.from = edge.from;
      edgeElement.dataset.to = edge.to;
      board.appendChild(edgeElement);
    });

    const statusElement = document.getElementById('blueprintStatus');
    if (statusElement) {
      statusElement.textContent = `Loaded blueprint: ${blueprint.name || 'Untitled Blueprint'}`;
    }
  }

  function loadBlueprintBySlug(slug) {
    if (!slug || !global.LogicHubBlueprint || !global.LogicHubBlueprint.getAllBlueprints) return;
    const allBlueprints = global.LogicHubBlueprint.getAllBlueprints();
    const blueprint = allBlueprints[slug];
    if (blueprint) {
      renderBlueprint(blueprint);
      global.LogicHubBlueprint.currentSlug = slug;
    }
  }

  function handleImport(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function () {
      try {
        const blueprint = JSON.parse(String(reader.result || '{}'));
        renderBlueprint(blueprint);
        const slug = (global.LogicHubBlueprint && global.LogicHubBlueprint.slugify)
          ? global.LogicHubBlueprint.slugify(blueprint.name || `imported-${Date.now()}`)
          : `imported-${Date.now()}`;
        const allBlueprints = global.LogicHubBlueprint.getAllBlueprints();
        allBlueprints[slug] = Object.assign({}, blueprint, { slug: slug });
        global.LogicHubBlueprint.setAllBlueprints(allBlueprints);
      } catch (error) {
        const statusElement = document.getElementById('blueprintStatus');
        if (statusElement) statusElement.textContent = 'Invalid blueprint JSON.';
      }
    };
    reader.readAsText(file);
  }

  function duplicateCurrentBlueprint() {
    if (!global.LogicHubBlueprint || !global.LogicHubBlueprint.collectCanvasState) return;
    const current = global.LogicHubBlueprint.collectCanvasState();
    const name = `${current.name || 'Blueprint'} Copy`;
    const slug = global.LogicHubBlueprint.slugify(name);
    const allBlueprints = global.LogicHubBlueprint.getAllBlueprints();
    allBlueprints[slug] = Object.assign({}, current, {
      name,
      slug,
      updated_at: new Date().toISOString()
    });
    global.LogicHubBlueprint.setAllBlueprints(allBlueprints);
    renderBlueprint(allBlueprints[slug]);

    const statusElement = document.getElementById('blueprintStatus');
    if (statusElement) statusElement.textContent = `Duplicated blueprint: ${name}`;
  }

  function initBlueprintLoad() {
    const slug = readBlueprintSlugFromURL();
    if (slug) {
      loadBlueprintBySlug(slug);
    }

    const importButton = document.getElementById('importBlueprintBtn');
    const importInput = document.getElementById('importBlueprintInput');
    if (importButton && importInput) {
      importButton.addEventListener('click', function () {
        importInput.click();
      });
      importInput.addEventListener('change', handleImport);
    }

    const duplicateButton = document.getElementById('duplicateBlueprintBtn');
    if (duplicateButton) {
      duplicateButton.addEventListener('click', duplicateCurrentBlueprint);
    }
  }

  global.LogicHubBlueprint = global.LogicHubBlueprint || {};
  global.LogicHubBlueprint.loadBlueprintBySlug = loadBlueprintBySlug;
  global.LogicHubBlueprint.renderBlueprint = renderBlueprint;
  global.LogicHubBlueprint.initBlueprintLoad = initBlueprintLoad;
})(window);
