import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "logichub.db");
const db = new Database(dbPath);

// Enable WAL mode for concurrency
db.pragma('journal_mode = WAL');

// Single-table storage model mapping Firestore collections
db.exec(`
  CREATE TABLE IF NOT EXISTS sovereign_documents (
    collection TEXT NOT NULL,
    doc_id TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (collection, doc_id)
  );
`);

export function getDb() {
  return db;
}

export const Filter = {
  or: (...filters) => ({ isFilter: true, op: 'OR', filters }),
  and: (...filters) => ({ isFilter: true, op: 'AND', filters }),
  where: (field, op, val) => ({ field, op, val })
};

function translateWhere(field, op, val, params) {
  let sqlOp = op;
  if (op === '==') sqlOp = '=';

  const isNumeric = ['viewCount', 'installs', 'remixes', 'ratings', 'amount'].includes(field);
  const expr = isNumeric ? `CAST(json_extract(data, '$.${field}') AS NUMERIC)` : `json_extract(data, '$.${field}')`;

  if (val === null) {
    if (sqlOp === '=') return `${expr} IS NULL`;
    if (sqlOp === '!=') return `${expr} IS NOT NULL`;
  }

  params.push(val);
  return `${expr} ${sqlOp} ?`;
}

function translateFilter(filter, params) {
  if (filter.op === 'OR') {
    const parts = filter.filters.map(f => {
      if (f.isFilter) return translateFilter(f, params);
      return translateWhere(f.field, f.op, f.val, params);
    }).filter(Boolean);
    return parts.join(' OR ');
  } else if (filter.op === 'AND') {
    const parts = filter.filters.map(f => {
      if (f.isFilter) return translateFilter(f, params);
      return translateWhere(f.field, f.op, f.val, params);
    }).filter(Boolean);
    return parts.join(' AND ');
  }
  return '';
}

class TimestampCompat {
  constructor(isoString) {
    this.isoString = isoString;
  }
  toDate() {
    return new Date(this.isoString);
  }
  toString() {
    return this.isoString;
  }
}

function wrapTimestamps(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(wrapTimestamps);

  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && (
      k.endsWith('_at') || 
      k.endsWith('_ts') || 
      k === 'timestamp' || 
      k === 'last_updated' || 
      k === 'reviewed_at' || 
      k === 'grantedAt' || 
      k === 'updatedAt' || 
      k === 'publishedAt' || 
      k === 'created_at' ||
      k === 'last_seen_at'
    )) {
      if (!isNaN(Date.parse(v))) {
        result[k] = new TimestampCompat(v);
        continue;
      }
    }
    result[k] = wrapTimestamps(v);
  }
  return result;
}

class DocumentSnapshot {
  constructor(collection, id, data) {
    this.collection = collection;
    this.id = id;
    this._data = data;
    this.exists = data !== undefined;
  }

  data() {
    return wrapTimestamps(this._data);
  }
}

class QuerySnapshot {
  constructor(docs) {
    this.docs = docs;
  }

  get size() {
    return this.docs.length;
  }

  get empty() {
    return this.docs.length === 0;
  }

  forEach(callback) {
    this.docs.forEach(callback);
  }
}

class DocumentRef {
  constructor(collection, id) {
    this.collection = collection;
    this.id = id;
  }

  async get() {
    return this.getSync();
  }

  getSync() {
    const row = db.prepare(`SELECT data FROM sovereign_documents WHERE collection = ? AND doc_id = ?`).get(this.collection, this.id);
    if (!row) {
      return new DocumentSnapshot(this.collection, this.id, undefined);
    }
    return new DocumentSnapshot(this.collection, this.id, JSON.parse(row.data));
  }

  async set(data, options = {}) {
    return this.setSync(data, options);
  }

  setSync(data, options = {}) {
    const now = new Date().toISOString();
    const existing = this.getSync();

    let finalData = {};
    if (options.merge && existing.exists) {
      finalData = { ...existing.data() };
    }

    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === 'object' && v.__type === 'increment') {
        const baseVal = Number(finalData[k] || 0);
        finalData[k] = baseVal + v.value;
      } else if (v && typeof v === 'object' && v.__type === 'serverTimestamp') {
        finalData[k] = now;
      } else if (v && typeof v === 'object' && v.__type === 'timestamp') {
        finalData[k] = v.value;
      } else {
        finalData[k] = v;
      }
    }

    // Ensure ID fields are synced inside the JSON payload too
    if (this.collection === 'apps') {
      finalData.app_id = this.id;
    } else if (this.collection === 'users' || this.collection === 'paidUsers') {
      finalData.uid = this.id;
    }

    const dataJson = JSON.stringify(finalData);
    db.prepare(`
      INSERT INTO sovereign_documents (collection, doc_id, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(collection, doc_id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `).run(this.collection, this.id, dataJson, existing.exists ? existing._data.created_at || now : now, now);

    return { id: this.id };
  }

  async update(data) {
    return this.setSync(data, { merge: true });
  }

  async delete() {
    return this.deleteSync();
  }

  deleteSync() {
    db.prepare(`DELETE FROM sovereign_documents WHERE collection = ? AND doc_id = ?`).run(this.collection, this.id);
  }
}

class CollectionRef {
  constructor(collectionName, query = { wheres: [], orderBys: [], limit: null }) {
    this.collectionName = collectionName;
    this.query = query;
  }

  doc(docId) {
    if (!docId) {
      docId = 'doc_' + Math.random().toString(36).slice(2, 11);
    }
    return new DocumentRef(this.collectionName, docId);
  }

  where(field, op, val) {
    const wheres = [...this.query.wheres];
    if (field && typeof field === 'object' && field.isFilter) {
      wheres.push({ isFilter: true, filter: field });
    } else {
      wheres.push({ field, op, val });
    }
    return new CollectionRef(this.collectionName, { ...this.query, wheres });
  }

  orderBy(field, direction = 'asc') {
    const orderBys = [...this.query.orderBys, { field, direction }];
    return new CollectionRef(this.collectionName, { ...this.query, orderBys });
  }

  limit(n) {
    return new CollectionRef(this.collectionName, { ...this.query, limit: n });
  }

  async get() {
    return this.getSync();
  }

  getSync() {
    let sql = `SELECT * FROM sovereign_documents WHERE collection = ?`;
    const params = [this.collectionName];

    if (this.query.wheres.length > 0) {
      const parts = [];
      for (const w of this.query.wheres) {
        if (w.isFilter) {
          const filterSql = translateFilter(w.filter, params);
          if (filterSql) {
            parts.push(`(${filterSql})`);
          }
        } else {
          const part = translateWhere(w.field, w.op, w.val, params);
          parts.push(part);
        }
      }
      sql += ` AND ` + parts.join(' AND ');
    }

    if (this.query.orderBys.length > 0) {
      const orderParts = this.query.orderBys.map(o => {
        return `json_extract(data, '$.${o.field}') ${o.direction.toUpperCase()}`;
      });
      sql += ` ORDER BY ` + orderParts.join(', ');
    }

    if (this.query.limit !== null) {
      sql += ` LIMIT ?`;
      params.push(this.query.limit);
    }

    const rows = db.prepare(sql).all(...params);
    return new QuerySnapshot(rows.map(r => new DocumentSnapshot(this.collectionName, r.doc_id, JSON.parse(r.data))));
  }
}

class TransactionContext {
  get(docRef) {
    return docRef.getSync();
  }
  set(docRef, data, options) {
    return docRef.setSync(data, options);
  }
  update(docRef, data) {
    return docRef.setSync(data, { merge: true });
  }
  delete(docRef) {
    return docRef.deleteSync();
  }
}

class Batch {
  constructor() {
    this.ops = [];
  }
  set(docRef, data, options) {
    this.ops.push({ type: 'set', docRef, data, options });
  }
  update(docRef, data) {
    this.ops.push({ type: 'update', docRef, data });
  }
  delete(docRef) {
    this.ops.push({ type: 'delete', docRef });
  }
  async commit() {
    const execute = db.transaction(() => {
      for (const op of this.ops) {
        if (op.type === 'set') {
          op.docRef.setSync(op.data, op.options);
        } else if (op.type === 'update') {
          op.docRef.updateSync(op.data);
        } else if (op.type === 'delete') {
          op.docRef.deleteSync();
        }
      }
    });
    execute();
  }
}

class FirestoreCompat {
  collection(name) {
    return new CollectionRef(name);
  }

  batch() {
    return new Batch();
  }

  async runTransaction(cb) {
    db.prepare('BEGIN IMMEDIATE').run();
    try {
      const txContext = new TransactionContext();
      const result = await cb(txContext);
      db.prepare('COMMIT').run();
      return result;
    } catch (err) {
      try {
        db.prepare('ROLLBACK').run();
      } catch (rollbackErr) {
        if (process.env.NODE_ENV === 'development') console.warn('[Database Rollback Failed]', rollbackErr);
      }
      throw err;
    }
  }
}

export const firestoreCompat = new FirestoreCompat();
