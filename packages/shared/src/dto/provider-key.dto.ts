import { z } from 'zod';

/** Providers whose user-owned tokens we can store (AES-256-GCM at rest). */
export const providerKindSchema = z.enum(['apify']);

export const providerKeyPutSchema = z.object({
  token: z.string().trim().min(10).max(500),
});

/** Never contains the raw token — only a masked hint and verification state. */
export const providerKeyInfoSchema = z.object({
  provider: providerKindSchema,
  connected: z.boolean(),
  lastFour: z.string().nullable(),
  lastVerifiedAt: z.date().or(z.string()).nullable(),
});

export const providerKeyRemoveResultSchema = z.object({
  removed: z.boolean(),
});

export type ProviderKind = z.infer<typeof providerKindSchema>;
export type ProviderKeyPut = z.infer<typeof providerKeyPutSchema>;
export type ProviderKeyInfo = z.infer<typeof providerKeyInfoSchema>;
export type ProviderKeyRemoveResult = z.infer<typeof providerKeyRemoveResultSchema>;
