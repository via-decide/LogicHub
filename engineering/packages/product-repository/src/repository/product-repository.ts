import type { ProductGraph } from '@logichub-engineering/product-graph';
import { propagate } from '@logichub-engineering/product-graph';
import { hashValue } from '@logichub-engineering/project-capsule';
import type {
  ProductIntent,
  ProductRevision,
  RevisionStamp,
} from '../schemas/revision.schema.js';
import type {
  EvidenceBinding,
  ValidationDecision,
} from '../schemas/governance.schema.js';

export interface CommitInput {
  intent: ProductIntent;
  stamp: RevisionStamp;
  graph: ProductGraph;
  author: string;
  message: string;
  createdAt: string;
}

/**
 * An append-only history of product revisions, with the decisions and
 * evidence recorded against each.
 *
 * Nothing is ever rewritten. A superseded revision stays exactly as it was
 * committed, because the record of what was believed at the time is the point
 * of keeping a history at all.
 */
export class ProductRepository {
  private readonly revisions = new Map<string, ProductRevision>();
  private readonly decisions: ValidationDecision[] = [];
  private readonly evidence: EvidenceBinding[] = [];
  private head: string | null = null;

  /** Commit a new revision on top of the current head. */
  commit(input: CommitInput): ProductRevision {
    const resolved = propagate(input.graph).graph;
    const graphHash = hashValue(resolved);

    const revisionId = `rev_${hashValue({
      parent: this.head,
      graphHash,
      message: input.message,
      createdAt: input.createdAt,
    }).slice(0, 16)}`;

    const revision: ProductRevision = {
      revisionId,
      parentRevisionId: this.head,
      intent: input.intent,
      stamp: input.stamp,
      graph: resolved,
      graphHash,
      author: input.author,
      message: input.message,
      createdAt: input.createdAt,
    };

    this.revisions.set(revisionId, revision);
    this.head = revisionId;
    return revision;
  }

  get(revisionId: string): ProductRevision | undefined {
    return this.revisions.get(revisionId);
  }

  require(revisionId: string): ProductRevision {
    const found = this.revisions.get(revisionId);
    if (!found) throw new Error(`Unknown revision: ${revisionId}`);
    return found;
  }

  headRevision(): ProductRevision | null {
    return this.head === null ? null : this.require(this.head);
  }

  /** The parent of a revision, or null at the root of the line. */
  parentOf(revisionId: string): ProductRevision | null {
    const revision = this.require(revisionId);
    return revision.parentRevisionId === null
      ? null
      : this.require(revision.parentRevisionId);
  }

  /** Walk from a revision back to the root, newest first. */
  history(revisionId: string): ProductRevision[] {
    const line: ProductRevision[] = [];
    let cursor: string | null = revisionId;
    while (cursor !== null) {
      const revision: ProductRevision = this.require(cursor);
      line.push(revision);
      cursor = revision.parentRevisionId;
    }
    return line;
  }

  recordDecision(decision: ValidationDecision): void {
    this.require(decision.revisionId);
    this.decisions.push(decision);
  }

  recordEvidence(binding: EvidenceBinding): void {
    this.require(binding.revisionId);
    this.evidence.push(binding);
  }

  /**
   * Decisions recorded against a revision. Only that revision's own decisions
   * are returned — nothing is inherited from an ancestor, because a judgement
   * about an earlier design is not automatically a judgement about this one.
   */
  decisionsFor(revisionId: string): ValidationDecision[] {
    return this.decisions
      .filter(d => d.revisionId === revisionId)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  evidenceFor(revisionId: string): EvidenceBinding[] {
    return this.evidence
      .filter(e => e.revisionId === revisionId)
      .sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
  }

  /**
   * Everything recorded anywhere in a revision's ancestry, newest first.
   *
   * Each entry keeps the revision it was recorded against, so a caller can
   * see how far back it came from and judge whether it still applies. This is
   * a lookup across history, not an inheritance rule.
   */
  decisionHistory(revisionId: string): ValidationDecision[] {
    const line = new Set(this.history(revisionId).map(r => r.revisionId));
    return this.decisions
      .filter(d => line.has(d.revisionId))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  evidenceHistory(revisionId: string): EvidenceBinding[] {
    const line = new Set(this.history(revisionId).map(r => r.revisionId));
    return this.evidence
      .filter(e => line.has(e.revisionId))
      .sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
  }

  size(): number {
    return this.revisions.size;
  }
}
