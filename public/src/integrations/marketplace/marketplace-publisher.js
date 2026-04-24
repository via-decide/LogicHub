(function (global) {
  'use strict';

  function ensureDependencies() {
    if (!global.LogicHubMarketplaceAdapter) {
      throw new Error('Marketplace adapter is unavailable.');
    }
    if (!global.LogicHubMarketplaceMetadataBuilder) {
      throw new Error('Metadata builder is unavailable.');
    }
  }

  function buildPublishPackage(options) {
    var safeOptions = options || {};
    var graph = safeOptions.graph || { nodes: [], edges: [] };

    if (!graph.nodes || !graph.nodes.length) {
      throw new Error('Cannot publish an empty app. Add at least one node.');
    }

    var metadata = global.LogicHubMarketplaceMetadataBuilder.buildMetadata({
      appId: safeOptions.appId,
      appName: safeOptions.appName,
      creatorPassport: safeOptions.creatorPassport,
      version: safeOptions.version,
      previousVersion: safeOptions.previousVersion,
      description: safeOptions.description,
      tags: safeOptions.tags,
      graph: graph
    });

    return {
      appName: metadata.app_id,
      metadata: metadata,
      build: {
        nodes: graph.nodes,
        edges: graph.edges || [],
        plan: safeOptions.plan || null,
        runtimeSnapshot: safeOptions.runtimeSnapshot || null
      }
    };
  }

  function publishBuiltApp(options) {
    ensureDependencies();

    var pkg = buildPublishPackage(options);
    return global.LogicHubMarketplaceAdapter.deploy(pkg, { slug: pkg.metadata.app_id }).then(function (result) {
      return {
        ok: Boolean(result && result.ok),
        publishedAt: new Date().toISOString(),
        metadata: pkg.metadata,
        package: pkg,
        remote: result
      };
    });
  }

  global.LogicHubMarketplacePublisher = {
    buildPublishPackage: buildPublishPackage,
    publishBuiltApp: publishBuiltApp
  };
})(window);
