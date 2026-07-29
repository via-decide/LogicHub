(function (global) {
  function workspaceCanvas() {
    const panels = ['Project Explorer', 'Architecture Graph', 'Requirements', 'AI Reasoning', 'Tasks', 'Git', 'Preview', 'Logs', 'Terminal', 'Deployment'];
    const files = ['src/', 'components/', 'api/', 'database/', 'tests/', 'docs/', 'deployment/', '.github/'];
    const generation = ['files created', 'files modified', 'tests added', 'documentation generated', 'migrations', 'APIs'];
    const memory = ['requirements', 'architectural decisions', 'design rationale', 'completed work', 'known issues', 'future roadmap'];
    return `
      <section class="workspace-canvas py-14">
        <p class="text-xs uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400 font-semibold">Builder Workspace</p><h2 class="mt-2 text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">An IDE-shaped operating system for engineering teams.</h2>
        <div class="mt-7 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-50 dark:bg-slate-900"><div class="font-semibold text-slate-900 dark:text-white">LogicHub Production Workspace</div><div class="flex flex-wrap gap-2 text-xs"><button id="importBlueprintBtn" class="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200">Import Context</button><button id="duplicateBlueprintBtn" class="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200">Duplicate Plan</button><button id="saveBlueprintBtn" class="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200">Save Memory</button><button id="shareBlueprintBtn" class="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200">Request Review</button><button id="exportZipBtn" class="px-3 py-1 rounded-lg bg-slate-900 text-white dark:bg-slate-700">Package</button><button id="generateAppBtn" class="px-3 py-1 rounded-lg bg-cyan-600 text-white">Run Pipeline</button></div></div>
          <div class="grid lg:grid-cols-[220px_1fr_300px] min-h-[520px]">
            <aside class="border-r border-slate-200 dark:border-slate-800 p-4"><h3 class="text-sm font-semibold text-slate-900 dark:text-white">Repository Intelligence</h3><ul class="mt-3 space-y-2">${files.map((file) => `<li class="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200">${file}</li>`).join('')}</ul></aside>
            <main class="p-4 bg-slate-50/70 dark:bg-slate-900/40"><div class="grid sm:grid-cols-2 gap-3">${panels.map((panel) => `<div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 p-4"><h3 class="text-sm font-semibold text-slate-900 dark:text-white">${panel}</h3><p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Live artifact with ownership, comments, approvals, change history, and reasoning history.</p></div>`).join('')}</div><input id="importBlueprintInput" class="hidden" type="file" accept="application/json"><p id="blueprintStatus" class="mt-3 text-xs text-slate-500 dark:text-slate-400"></p></main>
            <aside class="border-l border-slate-200 dark:border-slate-800 p-4"><h3 class="text-sm font-semibold text-slate-900 dark:text-white">Live Code Generation</h3><ul class="mt-3 space-y-2 text-sm">${generation.map((item) => `<li class="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">${item}</li>`).join('')}</ul><h3 class="mt-6 text-sm font-semibold text-slate-900 dark:text-white">Engineering Memory</h3><div class="mt-3 flex flex-wrap gap-2">${memory.map((item) => `<span class="rounded-full bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-200 px-3 py-1 text-xs">${item}</span>`).join('')}</div></aside>
          </div>
        </div>
      </section>
    `;
  }

  global.LogicHubComponents = global.LogicHubComponents || {};
  global.LogicHubComponents.workspaceCanvas = workspaceCanvas;
})(window);
