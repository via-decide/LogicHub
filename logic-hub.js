(function () {
  'use strict';

  function uid(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }

  const state = {
    userId: 'user_demo',
    maps: loadMaps(),
    activeMapId: null,
    selectedNodeId: null,
    connectMode: false,
    pendingEdgeFrom: null,
    viewport: { scale: 1, x: 0, y: 0 }
  };

  const editorViewport = document.getElementById('editorViewport');
  const edgeLayer = document.getElementById('edgeLayer');
  const nodeLayer = document.getElementById('nodeLayer');
  const feedList = document.getElementById('feedList');
  const nodePropsForm = document.getElementById('nodePropsForm');
  const nodePropsEmpty = document.getElementById('nodePropsEmpty');
  const simOutput = document.getElementById('simOutput');

  function loadMaps() {
    const raw = localStorage.getItem('logichub_maps');
    if (raw) return JSON.parse(raw);
    const starter = {
      id: uid('map'),
      title: 'Starter Map',
      parent_map_id: null,
      owner_user_id: 'user_demo',
      created_at: new Date().toISOString(),
      comments: [],
      nodes: [
        { id: uid('node'), type: 'input', label: 'Input A', data: { x: 80, y: 100, value: 2 } },
        { id: uid('node'), type: 'input', label: 'Input B', data: { x: 80, y: 220, value: 3 } },
        { id: uid('node'), type: 'compute', label: 'Sum', data: { x: 320, y: 160, expression: 'sum' } },
        { id: uid('node'), type: 'output', label: 'Result', data: { x: 560, y: 160, value: 0 } }
      ],
      edges: []
    };
    starter.edges.push(
      { id: uid('edge'), from: starter.nodes[0].id, to: starter.nodes[2].id, relation: 'depends_on' },
      { id: uid('edge'), from: starter.nodes[1].id, to: starter.nodes[2].id, relation: 'depends_on' },
      { id: uid('edge'), from: starter.nodes[2].id, to: starter.nodes[3].id, relation: 'influences' }
    );
    return [starter];
  }

  function saveMaps() {
    localStorage.setItem('logichub_maps', JSON.stringify(state.maps));
  }

  function activeMap() {
    if (!state.activeMapId && state.maps[0]) state.activeMapId = state.maps[0].id;
    return state.maps.find((m) => m.id === state.activeMapId);
  }

  function createMap(title, userId) {
    const map = {
      id: uid('map'), title, nodes: [], edges: [], comments: [],
      parent_map_id: null, owner_user_id: userId, created_at: new Date().toISOString()
    };
    state.maps.unshift(map);
    state.activeMapId = map.id;
    saveMaps();
    renderAll();
    return map;
  }

  function addNode(type) {
    const map = activeMap();
    if (!map) return;
    map.nodes.push({
      id: uid('node'),
      type,
      label: `${type} node`,
      data: { x: 120 + map.nodes.length * 30, y: 120 + map.nodes.length * 20, value: 0, expression: 'sum' }
    });
    saveMaps();
    renderEditor();
  }

  function connectNodes(map, fromId, toId, relation) {
    map.edges.push({ id: uid('edge'), from: fromId, to: toId, relation });
    saveMaps();
    renderEditor();
  }

  function fork(mapId, userId) {
    const source = state.maps.find((m) => m.id === mapId);
    if (!source) return null;
    const copy = JSON.parse(JSON.stringify(source));
    copy.id = uid('map');
    copy.parent_map_id = source.id;
    copy.owner_user_id = userId;
    copy.title = `${source.title} (fork)`;
    copy.created_at = new Date().toISOString();
    copy.comments = [];
    state.maps.unshift(copy);
    state.activeMapId = copy.id;
    saveMaps();
    renderAll();
    return copy;
  }

  function runSimulation(map, inputs) {
    const values = {};
    map.nodes.forEach((n) => {
      if (n.type === 'input') values[n.id] = Number(inputs[n.id] ?? n.data.value ?? 0);
      if (n.type === 'output') values[n.id] = Number(n.data.value ?? 0);
    });

    const inbound = {};
    map.edges.forEach((e) => {
      inbound[e.to] = inbound[e.to] || [];
      inbound[e.to].push(e.from);
    });

    let changed = true;
    let guard = 0;
    while (changed && guard < 10) {
      changed = false;
      guard += 1;

      map.nodes.forEach((node) => {
        if (node.type === 'compute') {
          const fromIds = inbound[node.id] || [];
          const inVals = fromIds.map((id) => Number(values[id] ?? 0));
          const next = node.data.expression === 'multiply'
            ? (inVals.length ? inVals.reduce((a, b) => a * b, 1) : 0)
            : inVals.reduce((a, b) => a + b, 0);
          if (values[node.id] !== next) {
            values[node.id] = next;
            changed = true;
          }
        }

        if (node.type === 'output') {
          const fromIds = inbound[node.id] || [];
          const next = fromIds.reduce((acc, id) => acc + Number(values[id] ?? 0), 0);
          if (values[node.id] !== next) {
            values[node.id] = next;
            changed = true;
          }
        }
      });
    }

    return {
      values,
      outputs: map.nodes
        .filter((n) => n.type === 'output')
        .map((n) => ({ id: n.id, label: n.label, value: values[n.id] ?? 0 }))
    };
  }

  function renderEditor() {
    const map = activeMap();
    if (!map) return;
    nodeLayer.innerHTML = '';
    edgeLayer.innerHTML = '';

    map.edges.forEach((edge) => {
      const from = map.nodes.find((n) => n.id === edge.from);
      const to = map.nodes.find((n) => n.id === edge.to);
      if (!from || !to) return;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(from.data.x + 60));
      line.setAttribute('y1', String(from.data.y + 20));
      line.setAttribute('x2', String(to.data.x + 60));
      line.setAttribute('y2', String(to.data.y + 20));
      line.setAttribute('stroke', '#58a6ff');
      line.setAttribute('stroke-width', '2');
      edgeLayer.appendChild(line);
    });

    map.nodes.forEach((node) => {
      const el = document.createElement('div');
      el.className = 'node' + (node.id === state.selectedNodeId ? ' selected' : '');
      el.style.left = `${node.data.x}px`;
      el.style.top = `${node.data.y}px`;
      el.textContent = `${node.label} (${node.type})`;

      el.addEventListener('click', () => {
        if (state.connectMode) {
          if (!state.pendingEdgeFrom) {
            state.pendingEdgeFrom = node.id;
          } else if (state.pendingEdgeFrom !== node.id) {
            connectNodes(map, state.pendingEdgeFrom, node.id, 'depends_on');
            state.pendingEdgeFrom = null;
          }
          return;
        }

        state.selectedNodeId = node.id;
        renderEditor();
        renderProps();
      });

      enableDrag(el, node);
      nodeLayer.appendChild(el);
    });
  }

  function enableDrag(element, node) {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    element.addEventListener('mousedown', (e) => {
      dragging = true;
      offsetX = e.clientX - node.data.x;
      offsetY = e.clientY - node.data.y;
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      node.data.x = Math.round(e.clientX - offsetX);
      node.data.y = Math.round(e.clientY - offsetY);
      renderEditor();
    });

    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      saveMaps();
    });
  }

  function applyViewport() {
    editorViewport.style.transform = `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.scale})`;
  }

  function initPanZoom() {
    editorViewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      state.viewport.scale = Math.min(2, Math.max(0.5, state.viewport.scale + delta));
      applyViewport();
    });

    let panning = false;
    let startX = 0;
    let startY = 0;

    editorViewport.addEventListener('contextmenu', (e) => e.preventDefault());
    editorViewport.addEventListener('mousedown', (e) => {
      if (e.button !== 1 && e.button !== 2) return;
      panning = true;
      startX = e.clientX - state.viewport.x;
      startY = e.clientY - state.viewport.y;
    });

    window.addEventListener('mousemove', (e) => {
      if (!panning) return;
      state.viewport.x = e.clientX - startX;
      state.viewport.y = e.clientY - startY;
      applyViewport();
    });

    window.addEventListener('mouseup', () => { panning = false; });
  }

  function renderProps() {
    const map = activeMap();
    const node = map?.nodes.find((n) => n.id === state.selectedNodeId);
    if (!node) {
      nodePropsEmpty.classList.remove('hidden');
      nodePropsForm.classList.add('hidden');
      return;
    }

    nodePropsEmpty.classList.add('hidden');
    nodePropsForm.classList.remove('hidden');
    nodePropsForm.label.value = node.label;
    nodePropsForm.type.value = node.type;
    nodePropsForm.expression.value = node.data.expression || 'sum';
    nodePropsForm.value.value = node.data.value ?? 0;
  }

  function renderFeed() {
    const tpl = document.getElementById('feedItemTemplate');
    feedList.innerHTML = '';
    state.maps.forEach((map) => {
      const li = tpl.content.firstElementChild.cloneNode(true);
      li.querySelector('.title').textContent = map.title;
      li.querySelector('.meta').textContent = `nodes:${map.nodes.length} edges:${map.edges.length}`;
      const commentsList = li.querySelector('.comments');
      map.comments.forEach((c) => {
        const cEl = document.createElement('li');
        cEl.textContent = `${c.user}: ${c.text}`;
        commentsList.appendChild(cEl);
      });

      li.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          if (action === 'view') {
            state.activeMapId = map.id;
            renderEditor();
          }
          if (action === 'fork') fork(map.id, state.userId);
          if (action === 'comment') {
            map.comments.push({ user: state.userId, text: 'Nice map!', at: new Date().toISOString() });
            saveMaps();
            renderFeed();
          }
          if (action === 'simulate') {
            const result = runSimulation(map, {});
            simOutput.textContent = JSON.stringify(result, null, 2);
          }
        });
      });

      feedList.appendChild(li);
    });
  }

  function renderAll() {
    renderEditor();
    renderProps();
    renderFeed();
  }

  document.getElementById('newMapBtn').addEventListener('click', () => {
    const title = prompt('Map title?', 'Untitled Map');
    if (title) createMap(title, state.userId);
  });
  document.getElementById('addInputBtn').addEventListener('click', () => addNode('input'));
  document.getElementById('addComputeBtn').addEventListener('click', () => addNode('compute'));
  document.getElementById('addOutputBtn').addEventListener('click', () => addNode('output'));

  document.getElementById('connectModeBtn').addEventListener('click', (e) => {
    state.connectMode = !state.connectMode;
    state.pendingEdgeFrom = null;
    e.target.textContent = `Connect Mode: ${state.connectMode ? 'On' : 'Off'}`;
  });

  document.getElementById('runSimBtn').addEventListener('click', () => {
    const map = activeMap();
    const result = runSimulation(map, {});
    simOutput.textContent = JSON.stringify(result, null, 2);
  });

  nodePropsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const map = activeMap();
    const node = map?.nodes.find((n) => n.id === state.selectedNodeId);
    if (!node) return;
    node.label = nodePropsForm.label.value;
    node.type = nodePropsForm.type.value;
    node.data.expression = nodePropsForm.expression.value;
    node.data.value = Number(nodePropsForm.value.value);
    saveMaps();
    renderAll();
  });

  initPanZoom();
  applyViewport();
  renderAll();
})();
