(function (global) {
  function workspaceCanvas() {
    const modules = ['Screen', 'Login', 'Data', 'Logic', 'Style', 'API', 'Storage'];
    const timeline = ['Planning architecture...', 'Analyzing modules...', 'Generating structure...', 'Preparing export...'];

    return `
      <section class="workspace-canvas py-14">
        <h2 class="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">Workspace UX</h2>
        <div class="mt-7 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-50 dark:bg-slate-900">
            <div class="font-semibold text-slate-900 dark:text-white">Logichub</div>
            <div class="flex flex-wrap gap-2 text-xs">
              <button id="saveBlueprintBtn" class="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200">Save Blueprint</button>
              <button id="shareBlueprintBtn" class="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200">Share</button>
              <button id="exportZipBtn" class="px-3 py-1 rounded-lg bg-slate-900 text-white dark:bg-slate-700">Export ZIP</button>
              <button id="generateAppBtn" class="px-3 py-1 rounded-lg bg-cyan-600 text-white">Generate App</button>
            </div>
          </div>
          <div class="grid lg:grid-cols-[220px_1fr_260px] min-h-[420px]">
            <aside class="border-r border-slate-200 dark:border-slate-800 p-4">
              <h3 class="text-sm font-semibold text-slate-900 dark:text-white">System Modules</h3>
              <ul class="mt-3 space-y-2">
                ${modules.map((module) => `<li class="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200">${module}</li>`).join('')}
              </ul>
            </aside>
            <main class="p-4 bg-slate-50/70 dark:bg-slate-900/40">
              <h3 class="text-sm font-semibold text-slate-900 dark:text-white">System Canvas</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Drag modules to design system flow.</p>
              <div id="workspaceCanvasBoard" class="mt-4 h-[320px] rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 relative overflow-hidden">
                <div class="workspace-node absolute rounded-lg border border-cyan-300 bg-cyan-50 dark:bg-cyan-900/30 dark:border-cyan-700 text-xs font-medium px-3 py-2 text-slate-800 dark:text-slate-100" data-id="1" data-type="screen" data-x="60" data-y="80" style="left:60px;top:80px;">Screen</div>
                <div class="workspace-node absolute rounded-lg border border-violet-300 bg-violet-50 dark:bg-violet-900/30 dark:border-violet-700 text-xs font-medium px-3 py-2 text-slate-800 dark:text-slate-100" data-id="2" data-type="api" data-x="240" data-y="180" style="left:240px;top:180px;">API</div>
                <div class="workspace-edge hidden" data-from="1" data-to="2"></div>
              </div>
              <div class="mt-3 flex flex-wrap gap-2 text-xs">
                <button id="importBlueprintBtn" class="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200">Import Blueprint</button>
                <button id="duplicateBlueprintBtn" class="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200">Duplicate and Edit</button>
                <a href="../blueprints/" class="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200">Browse Public Blueprints</a>
              </div>
              <input id="importBlueprintInput" class="hidden" type="file" accept="application/json">
              <p id="blueprintStatus" class="mt-3 text-xs text-slate-500 dark:text-slate-400"></p>
            </main>
            <aside class="border-l border-slate-200 dark:border-slate-800 p-4">
              <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Zayvora Reasoning</h3>
              <ul class="mt-3 space-y-2 text-sm">
                ${timeline.map((item) => `<li class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">${item}</li>`).join('')}
              </ul>
            </aside>
          </div>
        </div>
      </section>
    `;
  }

  global.LogicHubComponents = global.LogicHubComponents || {};
  global.LogicHubComponents.workspaceCanvas = workspaceCanvas;
})(window);
