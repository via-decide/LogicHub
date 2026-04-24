(function (global) {
  const STORAGE_KEY = 'logichub_blueprints';

  function getAllBlueprints() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function setAllBlueprints(allBlueprints) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allBlueprints));
  }

  function slugify(name) {
    return String(name || 'untitled-blueprint')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function collectCanvasState() {
    const nodeElements = Array.from(document.querySelectorAll('.workspace-node'));
    const edgeElements = Array.from(document.querySelectorAll('.workspace-edge'));

    const nodes = nodeElements.map((node) => ({
      id: node.dataset.id,
      type: node.dataset.type,
      x: Number(node.dataset.x || parseInt(node.style.left, 10) || 0),
      y: Number(node.dataset.y || parseInt(node.style.top, 10) || 0)
    }));

    const edges = edgeElements.map((edge) => ({
      from: edge.dataset.from,
      to: edge.dataset.to
    }));

    return {
      name: 'Untitled Blueprint',
      nodes,
      edges
    };
  }

  function setStatus(message) {
    const statusElement = document.getElementById('blueprintStatus');
    if (statusElement) {
      statusElement.textContent = message;
    }
  }

  function saveBlueprint() {
    const current = collectCanvasState();
    const providedName = global.prompt('Blueprint name:', current.name) || current.name;
    const name = providedName.trim() || current.name;
    const slug = slugify(name);
    const allBlueprints = getAllBlueprints();

    current.name = name;
    current.slug = slug;
    current.updated_at = new Date().toISOString();

    allBlueprints[slug] = current;
    setAllBlueprints(allBlueprints);

    global.LogicHubBlueprint = global.LogicHubBlueprint || {};
    global.LogicHubBlueprint.currentSlug = slug;

    setStatus(`Saved blueprint: ${name}`);
    return current;
  }

  function shareBlueprint() {
    const state = saveBlueprint();
    const shareUrl = `${location.origin}${location.pathname}?blueprint=${encodeURIComponent(state.slug)}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
    }

    setStatus(`Share link ready: ${shareUrl}`);
    return shareUrl;
  }

  function exportBlueprintJSON() {
    const state = saveBlueprint();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${state.slug || 'blueprint'}.json`;
    link.click();
    URL.revokeObjectURL(url);

    setStatus('Blueprint exported as JSON.');
  }

  global.LogicHubBlueprint = global.LogicHubBlueprint || {};
  global.LogicHubBlueprint.getAllBlueprints = getAllBlueprints;
  global.LogicHubBlueprint.setAllBlueprints = setAllBlueprints;
  global.LogicHubBlueprint.collectCanvasState = collectCanvasState;
  global.LogicHubBlueprint.saveBlueprint = saveBlueprint;
  global.LogicHubBlueprint.shareBlueprint = shareBlueprint;
  global.LogicHubBlueprint.exportBlueprintJSON = exportBlueprintJSON;
  global.LogicHubBlueprint.slugify = slugify;
})(window);
