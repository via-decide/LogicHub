(function (global) {
  function workflowSteps() {
    const steps = [
      {
        title: '1. Add modules',
        bullets: ['Screen', 'Login', 'Data', 'Logic']
      },
      {
        title: '2. Generate system plan',
        bullets: ['Validate dependencies', 'Compose architecture map', 'Build planning timeline']
      },
      {
        title: '3. Export project',
        bullets: ['ZIP', 'Android', 'Deploy']
      }
    ];

    return `
      <section class="workflow-steps py-14">
        <h2 class="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">How It Works</h2>
        <div class="mt-7 grid md:grid-cols-3 gap-5">
          ${steps.map((step) => `
            <article class="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 bg-slate-50 dark:bg-slate-900">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">${step.title}</h3>
              <ul class="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                ${step.bullets.map((bullet) => `<li class="flex items-center gap-2"><span class="text-cyan-500">●</span>${bullet}</li>`).join('')}
              </ul>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  global.LogicHubComponents = global.LogicHubComponents || {};
  global.LogicHubComponents.workflowSteps = workflowSteps;
})(window);
