(function (global) {
  'use strict';

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'logichub-app';
  }

  function parseTags(tagsInput) {
    if (Array.isArray(tagsInput)) return tagsInput.filter(Boolean);

    return String(tagsInput || '')
      .split(',')
      .map(function (tag) { return tag.trim().toLowerCase(); })
      .filter(Boolean)
      .filter(function (tag, index, arr) { return arr.indexOf(tag) === index; })
      .slice(0, 8);
  }

  function defaultDescription(nodes) {
    if (!nodes.length) return 'Workflow app generated in LogicHub Studio.';
    return 'Workflow with ' + nodes.length + ' nodes including ' + nodes[0].title + '.';
  }

  function buildMetadata(input) {
    var safeInput = input || {};
    var graph = safeInput.graph || { nodes: [] };
    var nodes = graph.nodes || [];
    var versionManager = global.LogicHubMarketplaceVersionManager;

    var appId = slugify(safeInput.appId || safeInput.appName || (nodes[0] && nodes[0].title));
    var creatorPassport = String(safeInput.creatorPassport || 'anonymous@logichub').trim();
    var version = versionManager
      ? versionManager.resolveVersion(safeInput.version, safeInput.previousVersion)
      : String(safeInput.version || '0.1.0');

    return {
      app_id: appId,
      creator_passport: creatorPassport,
      version: version,
      description: String(safeInput.description || '').trim() || defaultDescription(nodes),
      tags: parseTags(safeInput.tags)
    };
  }

  global.LogicHubMarketplaceMetadataBuilder = { buildMetadata: buildMetadata };
})(window);
