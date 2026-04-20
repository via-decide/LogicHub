(function (global) {
  function featureGrid() {
    const blocks = [
      {
        icon: '🧠',
        title: 'Prompt Apps',
        body: 'Create AI tools without coding.',
        example: 'Example: Customer support copilot with guided prompts.'
      },
      {
        icon: '🏗️',
        title: 'System Architecture',
        body: 'Design full application flows.',
        example: 'Example: Auth + dashboard + API + data lifecycle map.'
      },
      {
        icon: '📦',
        title: 'App Skeletons',
        body: 'Generate ready-to-run project structures.',
        example: 'Example: Starter bundle with routes, services, and config.'
      }
    ];

    return `
      <section class="feature-grid py-14">
        <h2 class="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">What You Can Build</h2>
        <div class="mt-7 grid md:grid-cols-3 gap-5">
          ${blocks.map((item) => `
            <article class="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 bg-white dark:bg-slate-950">
              <div class="text-2xl">${item.icon}</div>
              <h3 class="mt-4 text-lg font-semibold text-slate-900 dark:text-white">${item.title}</h3>
              <p class="mt-2 text-slate-600 dark:text-slate-300">${item.body}</p>
              <p class="mt-3 text-xs text-slate-500 dark:text-slate-400">${item.example}</p>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  global.LogicHubComponents = global.LogicHubComponents || {};
  global.LogicHubComponents.featureGrid = featureGrid;
})(window);
