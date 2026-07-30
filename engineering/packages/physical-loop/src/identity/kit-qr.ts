import { sha256Hex } from '@logichub-engineering/project-capsule';
import { getKit, kitToGraph, type PhysicalKitDefinition } from '@logichub-engineering/kit-matching';
import type { ProductGraph } from '@logichub-engineering/product-graph';
import { KitIdentitySchema, type KitIdentity } from '../schemas/loop.schema.js';

const PREFIX = 'LHKIT';
const VERSION = '1';

/**
 * Encode a kit identity as a QR payload.
 *
 * The payload carries everything needed to resolve the kit offline. It is not
 * a URL: scanning must not depend on reaching a server, or a kit would become
 * unusable the moment the service moved.
 *
 * The trailing digest guards against a mistyped or damaged code being
 * accepted as a different valid kit. It is a transcription check, not a
 * security measure, and does not make the payload tamper-proof.
 */
export function encodeKitQr(identity: KitIdentity): string {
  const body = [PREFIX, VERSION, identity.kitId, identity.unitSerial, identity.hardwareRevision]
    .join(':');
  return `${body}:${checkDigest(body)}`;
}

export function decodeKitQr(payload: string): KitIdentity {
  const parts = payload.split(':');
  if (parts.length !== 6) {
    throw new Error('QR payload is not a LogicHub kit code.');
  }

  const [prefix, version, kitId, unitSerial, hardwareRevision, digest] = parts as [
    string, string, string, string, string, string,
  ];

  if (prefix !== PREFIX) {
    throw new Error('QR payload is not a LogicHub kit code.');
  }
  if (version !== VERSION) {
    throw new Error(`Unsupported kit code version: ${version}`);
  }

  const body = [prefix, version, kitId, unitSerial, hardwareRevision].join(':');
  if (digest !== checkDigest(body)) {
    throw new Error('Kit code failed its check digest; it may have been mistranscribed.');
  }

  const result = KitIdentitySchema.safeParse({ kitId, unitSerial, hardwareRevision });
  if (!result.success) {
    throw new Error(`Kit code carries an invalid identity: ${result.error.issues[0]?.message}`);
  }

  return result.data;
}

export interface ResolvedKit {
  identity: KitIdentity;
  kit: PhysicalKitDefinition;
  /** The kit loaded as an editable graph, ready to work from. */
  graph: ProductGraph;
}

export interface ResolveKitOptions {
  /** Timestamp for the generated graph. Pass a fixed value for reproducibility. */
  now?: string;
}

/**
 * Resolve a scanned code to the exact kit manifest it names.
 *
 * A code naming a kit this build does not know is rejected outright rather
 * than resolved to something approximate.
 */
export function resolveKitFromQr(payload: string, options: ResolveKitOptions = {}): ResolvedKit {
  const identity = decodeKitQr(payload);
  const kit = getKit(identity.kitId);
  if (kit === undefined) {
    throw new Error(`Kit code names an unknown kit: ${identity.kitId}`);
  }

  return {
    identity,
    kit,
    graph: kitToGraph(kit, { now: options.now }),
  };
}

function checkDigest(body: string): string {
  return sha256Hex(body).slice(0, 8);
}
