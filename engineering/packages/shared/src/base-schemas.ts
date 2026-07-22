import { z } from 'zod';

export const CURRENT_SCHEMA_VERSION = '0.1.0';

export const MetadataSchema = z.record(z.string(), z.unknown()).optional();
export type Metadata = z.infer<typeof MetadataSchema>;

export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export type Sha256 = z.infer<typeof Sha256Schema>;
