(function (global) {
  'use strict';

  function ensurePipelineDependencies() {
    if (!global.LogicHubWorkflowParser) throw new Error('LogicHubWorkflowParser is required.');
    if (!global.LogicHubNodeCompiler) throw new Error('LogicHubNodeCompiler is required.');
    if (!global.LogicHubAppConfigBuilder) throw new Error('LogicHubAppConfigBuilder is required.');
    if (!global.LogicHubComponentBundler) throw new Error('LogicHubComponentBundler is required.');
    if (!global.LogicHubRuntimePackager) throw new Error('LogicHubRuntimePackager is required.');
  }

  function compile(workflow, options) {
    ensurePipelineDependencies();

    var safeWorkflow = workflow || { graph: { nodes: [], edges: [] }, task: {} };
    var parsed = global.LogicHubWorkflowParser.parseGraph(safeWorkflow.graph || {});
    var compiledPlan = global.LogicHubNodeCompiler.compile(parsed);
    var appConfig = global.LogicHubAppConfigBuilder.buildConfig(safeWorkflow, options || {});
    var bundledComponents = global.LogicHubComponentBundler.bundle(safeWorkflow, compiledPlan, appConfig);
    var runtimePackage = global.LogicHubRuntimePackager.packageRuntime(bundledComponents, appConfig);

    return {
      workflow: safeWorkflow,
      compiledAt: new Date().toISOString(),
      pipeline: ['workflow', 'component-compiler', 'runtime-package', 'deployable-build'],
      deployableBuild: runtimePackage,
      isRunnable: !!(runtimePackage && runtimePackage.files && runtimePackage.files['index.html'] && runtimePackage.files['app.js'])
    };
  }

  global.LogicHubAppCompiler = {
    compile: compile
  };
})(window);
