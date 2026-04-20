(function (global) {
  function heroSection() {
    return `
      <section class="hero-section rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white/90 dark:bg-slate-950/70 shadow-xl p-8 md:p-12">
        <div class="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p class="text-xs tracking-[0.2em] uppercase text-cyan-600 dark:text-cyan-400 font-semibold">LOGICHUB</p>
            <h1 class="mt-3 text-4xl md:text-5xl font-semibold leading-tight text-slate-900 dark:text-white">The Thinking Layer Before Coding</h1>
            <p class="mt-5 text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-xl">Plan systems, design architecture, and generate working app structures before writing code.</p>
            <div class="mt-8 flex flex-wrap gap-3">
              <button class="px-5 py-3 rounded-xl bg-cyan-600 text-white font-medium hover:bg-cyan-500 transition">Start Planning</button>
              <button class="px-5 py-3 rounded-xl bg-slate-900 text-white dark:bg-slate-700 font-medium hover:bg-slate-700">Open Workspace</button>
              <button class="px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium">See Example</button>
            </div>
          </div>
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 bg-slate-50 dark:bg-slate-900">
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Ecosystem Flow</p>
            <div class="space-y-3 text-sm font-mono">
              <div class="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Idea</div>
              <div class="text-center text-cyan-500">↓</div>
              <div class="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 border border-cyan-200 dark:border-cyan-700">Logichub <span class="text-xs text-slate-500">(planning)</span></div>
              <div class="text-center text-cyan-500">↓</div>
              <div class="p-3 rounded-lg bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700">Zayvora <span class="text-xs text-slate-500">(reasoning)</span></div>
              <div class="text-center text-cyan-500">↓</div>
              <div class="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700">Daxini <span class="text-xs text-slate-500">(execution)</span></div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  global.LogicHubComponents = global.LogicHubComponents || {};
  global.LogicHubComponents.heroSection = heroSection;
})(window);
