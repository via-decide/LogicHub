# LogicHub Architecture

## 1) Data Model

```js
Map {
  id: string
  title: string
  parent_map_id: string | null
  owner_user_id: string
  nodes: Node[]
  edges: Edge[]
  created_at: string
}

Node {
  id: string
  type: 'input' | 'compute' | 'output'
  label: string
  data: {
    x: number
    y: number
    expression?: string
    value?: number
  }
}

Edge {
  id: string
  from: string
  to: string
  relation: 'depends_on' | 'influences'
}
```

## 2) Frontend Components

- `MapStore`: in-memory state and persistence to `localStorage`.
- `MapEditor`: canvas-like board with drag, connect, pan/zoom.
- `PropertiesPanel`: edit selected node label/type/value/expression.
- `Feed`: list maps with actions: view, fork, comment, run simulation.

## 3) Fork System

`fork(mapId, userId)`:
1. Deep clone source map.
2. Assign new `id`.
3. Set `parent_map_id = mapId`.
4. Set `owner_user_id = userId`.
5. Append cloned map to store.

## 4) Simulation Engine

`runSimulation(map, inputs)`:
1. Apply provided inputs onto `input` nodes.
2. Build adjacency from edges.
3. Topologically process nodes with simple expression support (`sum`, `multiply`).
4. Return computed node values and output node summary.

## 5) Storage/Backend Evolution Path

Current example is browser-only (`localStorage`).
A production stack can use:
- Supabase `maps`, `nodes`, `edges`, `comments`, `forks` tables.
- Row-level security by `owner_user_id`.
- Realtime feed by map insert/update subscriptions.

## 6) API Surface (logical)

- `createMap(title, userId)`
- `addNode(mapId, node)`
- `connectNodes(mapId, fromId, toId, relation)`
- `fork(mapId, userId)`
- `runSimulation(map, inputs)`
- `listFeed()`

