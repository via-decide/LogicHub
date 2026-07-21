import { z } from 'zod';

export const ISODateTimeSchema = z.string().datetime({ offset: true });
export type ISODateTime = z.infer<typeof ISODateTimeSchema>;
