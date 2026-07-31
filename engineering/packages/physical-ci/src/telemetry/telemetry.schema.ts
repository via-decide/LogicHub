import { z } from 'zod';

/**
 * Telemetry from a physical inspection node.
 *
 * A vendor's pull request is a claim about a physical object. These are the
 * readings that either support it or do not. They are treated the way a commit
 * is treated: content-addressed, and worthless the moment they are altered.
 *
 * Every numeric is `.finite()`. NaN and Infinity are refused at the boundary
 * rather than propagating into a comparison, where `NaN > tolerance` is false
 * and would read as a pass.
 */

/** The kinds of node that can report. A submission declares which it expects. */
export const InspectionNodeKindSchema = z.enum([
  'micrometer',
  'scale',
  'imu',
  'capacitive',
]);
export type InspectionNodeKind = z.infer<typeof InspectionNodeKindSchema>;

/**
 * A single reading, timestamped by the node that took it.
 *
 * `sequence` is the node's own monotonic counter. It exists so a gap or a
 * repeat is detectable even when two frames share a millisecond — which real
 * hardware does constantly, and which a timestamp alone cannot distinguish
 * from a replayed frame.
 */
export const TelemetryFrameSchema = z.object({
  sequence: z.number().int().nonnegative(),
  /** Milliseconds since the node's epoch. */
  timestampMs: z.number().finite(),
  /** Reading values by channel. Channel names are node-specific. */
  values: z.record(z.string().min(1), z.number().finite()),
});
export type TelemetryFrame = z.infer<typeof TelemetryFrameSchema>;

export const TelemetryStreamSchema = z.object({
  nodeId: z.string().min(1),
  nodeKind: InspectionNodeKindSchema,
  /** Firmware or fixture revision, so a reading can be traced to what took it. */
  nodeRevision: z.string().min(1),
  unit: z.string().min(1),
  frames: z.array(TelemetryFrameSchema).min(1),
});
export type TelemetryStream = z.infer<typeof TelemetryStreamSchema>;

/**
 * Everything one inspection produced, as submitted.
 *
 * `declaredDigest` is what the vendor says the payload hashes to. It is
 * deliberately part of the submission and deliberately excluded from the
 * digest computation — a hash cannot cover itself.
 */
export const TelemetryPayloadSchema = z.object({
  submissionId: z.string().min(1),
  vendorId: z.string().min(1),
  /** The physical unit this inspection is about. */
  partNumber: z.string().min(1),
  serialNumber: z.string().min(1),
  capturedAt: z.string().datetime(),
  streams: z.array(TelemetryStreamSchema).min(1),
});
export type TelemetryPayload = z.infer<typeof TelemetryPayloadSchema>;

export const SubmissionSchema = z.object({
  payload: TelemetryPayloadSchema,
  declaredDigest: z.string().regex(/^[a-f0-9]{64}$/, 'expected a lowercase sha256 hex digest'),
});
export type Submission = z.infer<typeof SubmissionSchema>;
