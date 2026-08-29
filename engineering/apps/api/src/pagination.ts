export interface PageParams {
  limit: number;
  offset: number;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePageParams(query: Record<string, unknown>): PageParams {
  const rawLimit = Number(query.limit);
  const rawOffset = Number(query.offset);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;
  return { limit, offset };
}

/**
 * In-memory pagination over an already-loaded array. The underlying
 * repository interfaces (persistence, Phase 2) expose only
 * findByProjectId/findByRevisionId-style full-collection reads -- no
 * LIMIT/OFFSET at the SQL layer -- so this is the correct place to add
 * pagination without touching that already-tested layer. Adequate at v0.1
 * scale; a persistence-layer LIMIT/OFFSET would be the natural next step if
 * per-project collections grow large.
 */
export function paginate<T>(items: T[], params: PageParams): PageResult<T> {
  const total = items.length;
  const page = items.slice(params.offset, params.offset + params.limit);
  return { items: page, total, limit: params.limit, offset: params.offset, hasMore: params.offset + params.limit < total };
}
