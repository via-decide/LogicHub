(function (global) {
  const publicTemplates = [
    {
      name: 'AI Chat App',
      slug: 'ai-chat-app',
      nodes: [
        { id: '1', type: 'screen', x: 50, y: 80 },
        { id: '2', type: 'api', x: 220, y: 80 },
        { id: '3', type: 'logic', x: 390, y: 80 }
      ],
      edges: [{ from: '1', to: '2' }, { from: '2', to: '3' }]
    },
    {
      name: 'Task Manager',
      slug: 'task-manager',
      nodes: [{ id: '1', type: 'screen', x: 80, y: 110 }, { id: '2', type: 'storage', x: 270, y: 140 }],
      edges: [{ from: '1', to: '2' }]
    },
    {
      name: 'Marketplace App',
      slug: 'marketplace-app',
      nodes: [{ id: '1', type: 'screen', x: 70, y: 90 }, { id: '2', type: 'api', x: 260, y: 120 }, { id: '3', type: 'storage', x: 430, y: 160 }],
      edges: [{ from: '1', to: '2' }, { from: '2', to: '3' }]
    },
    {
      name: 'Research Tool',
      slug: 'research-tool',
      nodes: [{ id: '1', type: 'screen', x: 90, y: 100 }, { id: '2', type: 'logic', x: 270, y: 140 }, { id: '3', type: 'api', x: 450, y: 180 }],
      edges: [{ from: '1', to: '2' }, { from: '2', to: '3' }]
    },
    {
      name: 'Game Backend',
      slug: 'game-backend',
      nodes: [{ id: '1', type: 'api', x: 120, y: 120 }, { id: '2', type: 'storage', x: 300, y: 160 }],
      edges: [{ from: '1', to: '2' }]
    }
  ];

  function saveTemplateToLocalStorage(template, duplicate) {
    const api = global.LogicHubBlueprint;
    if (!api || !api.getAllBlueprints || !api.setAllBlueprints || !api.slugify) return null;

    const allBlueprints = api.getAllBlueprints();
    const name = duplicate ? `${template.name} Copy` : template.name;
    const slug = duplicate ? api.slugify(`${template.slug}-${Date.now()}`) : template.slug;

    allBlueprints[slug] = {
      name: name,
      slug: slug,
      nodes: template.nodes,
      edges: template.edges,
      updated_at: new Date().toISOString()
    };

    api.setAllBlueprints(allBlueprints);
    return slug;
  }

  function cardHTML(template) {
    return `
      <article class="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-950">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">${template.name}</h3>
        <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">${template.nodes.length} nodes · ${template.edges.length} connections</p>
        <div class="mt-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-3 text-xs text-slate-600 dark:text-slate-300">Preview: ${template.nodes.map((n) => n.type).join(' → ')}</div>
        <div class="mt-4 flex flex-wrap gap-2 text-xs">
          <a class="px-3 py-1 rounded-lg bg-cyan-600 text-white" href="../pages/index.html?blueprint=${encodeURIComponent(template.slug)}">Open in Logichub</a>
          <button class="duplicate-template-btn px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200" data-slug="${template.slug}">Duplicate Blueprint</button>
        </div>
      </article>
    `;
  }

  function initBlueprintLibrary() {
    const container = document.getElementById('blueprintLibraryGrid');
    if (!container) return;

    publicTemplates.forEach((template) => {
      saveTemplateToLocalStorage(template, false);
    });

    container.innerHTML = publicTemplates.map(cardHTML).join('');

    container.querySelectorAll('.duplicate-template-btn').forEach((button) => {
      button.addEventListener('click', function () {
        const slug = button.dataset.slug;
        const template = publicTemplates.find((item) => item.slug === slug);
        if (!template) return;
        const newSlug = saveTemplateToLocalStorage(template, true);
        if (newSlug) {
          location.href = `../pages/index.html?blueprint=${encodeURIComponent(newSlug)}`;
        }
      });
    });
  }

  global.LogicHubBlueprintLibrary = {
    initBlueprintLibrary: initBlueprintLibrary
  };
})(window);
