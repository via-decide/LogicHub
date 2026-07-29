import { z } from 'zod';
import { ProductGraphSchema } from '@logichub-engineering/product-graph';

/** What the product is meant to do, carried forward with every revision. */
export const ProductIntentSchema = z.object({
  statement: z.string().min(1),
  targetProductTemplateIds: z.array(z.string().min(1)),
  notes: z.string(),
});
export type ProductIntent = z.infer<typeof ProductIntentSchema>;

/**
 * The four revision streams a product carries. Each moves independently: a
 * firmware change does not imply a hardware change, and recording them
 * together is what makes a later "which build was this measured on?" answerable.
 */
export const RevisionStampSchema = z.object({
  hardware: z.string().min(1),
  firmware: z.string().min(1),
  application: z.string().min(1),
  enclosure: z.string().min(1),
});
export type RevisionStamp = z.infer<typeof RevisionStampSchema>;

export const ProductRevisionSchema = z.object({
  revisionId: z.string().min(1),
  /** Null for the first revision in a line. */
  parentRevisionId: z.string().min(1).nullable(),
  intent: ProductIntentSchema,
  stamp: RevisionStampSchema,
  graph: ProductGraphSchema,
  graphHash: z.string().regex(/^[a-f0-9]{64}$/),
  author: z.string().min(1),
  message: z.string().min(1),
  createdAt: z.string().min(1),
});
export type ProductRevision = z.infer<typeof ProductRevisionSchema>;
