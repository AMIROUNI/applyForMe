import { z } from 'zod';

export const sourceTypeSchema = z.enum(['api', 'rss', 'html', 'ai_extract']);
export const sourceStatusSchema = z.enum(['active', 'pending', 'disabled', 'broken']);
export const sourceAddedBySchema = z.enum(['system', 'ai', 'user']);
/** `server`: scraped by the API. `extension`: collected in the user's browser. */
export const sourceExecutionModeSchema = z.enum(['server', 'extension']);

/** ISO-3166 alpha-2 code, or `*` for a globally relevant source. */
export const sourceCountrySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(\*|[a-z]{2})$/, 'Must be a 2-letter ISO country code or "*"');

export const sourceConfigSchema = z
  .object({
    /** Legacy bespoke adapter id (remotive, remoteok, ...) — resolved first. */
    adapterId: z.string().min(1).max(60).optional(),
    endpoint: z.string().max(500).optional(),
    feedUrls: z.array(z.string().max(500)).max(10).optional(),
    sitemapUrl: z.string().max(500).optional(),
    selectors: z.record(z.string().max(300)).optional(),
    fieldMap: z.record(z.string().max(300)).optional(),
    query: z.record(z.string().max(300)).optional(),
  })
  .passthrough();

export const sourceHealthSchema = z.object({
  lastSuccessAt: z.date().or(z.string()).nullable(),
  lastErrorAt: z.date().or(z.string()).nullable(),
  failureCount: z.number().int().min(0),
  avgLatencyMs: z.number().min(0).nullable(),
});

export const jobSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  baseUrl: z.string(),
  type: sourceTypeSchema,
  countries: z.array(z.string()),
  categories: z.array(z.string()),
  remoteFriendly: z.boolean(),
  status: sourceStatusSchema,
  config: sourceConfigSchema,
  requiresUserToken: z.boolean(),
  executionMode: sourceExecutionModeSchema.default('server'),
  requiresExtension: z.boolean().default(false),
  health: sourceHealthSchema,
  addedBy: sourceAddedBySchema,
  /** Set only for sources created by a user; system/ai sources are shared. */
  ownerId: z.string().nullable(),
  createdAt: z.date().or(z.string()).nullable(),
});

export const sourceListQuerySchema = z.object({
  country: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{2}$/, 'Must be a 2-letter ISO country code')
    .optional(),
  type: sourceTypeSchema.optional(),
  status: sourceStatusSchema.optional(),
});

export const createSourceSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(280).default(''),
  baseUrl: z
    .string()
    .trim()
    .max(300)
    .refine(value => /^https?:\/\/.+/i.test(value), 'Must be an http(s) URL'),
  type: sourceTypeSchema,
  countries: z.array(sourceCountrySchema).max(30).default([]),
  categories: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  remoteFriendly: z.boolean().default(true),
  executionMode: sourceExecutionModeSchema.default('server'),
  config: sourceConfigSchema.default({}),
});

export const updateSourceSchema = createSourceSchema.partial().extend({
  status: sourceStatusSchema.optional(),
});

export const sourcePreviewJobSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string(),
  url: z.string(),
  postedAt: z.date().or(z.string()).nullable(),
});

export const sourceValidateResultSchema = z.object({
  id: z.string(),
  ok: z.boolean(),
  reachable: z.boolean(),
  runnable: z.boolean(),
  message: z.string(),
  latencyMs: z.number().int().min(0).nullable(),
  sampleCount: z.number().int().min(0),
  preview: z.array(sourcePreviewJobSchema),
  status: sourceStatusSchema,
  health: sourceHealthSchema,
});

export type SourceType = z.infer<typeof sourceTypeSchema>;
export type SourceStatus = z.infer<typeof sourceStatusSchema>;
export type SourceAddedBy = z.infer<typeof sourceAddedBySchema>;
export type SourceExecutionMode = z.infer<typeof sourceExecutionModeSchema>;
export type SourceConfig = z.infer<typeof sourceConfigSchema>;
export type SourceHealth = z.infer<typeof sourceHealthSchema>;
export type JobSource = z.infer<typeof jobSourceSchema>;
export type SourceListQuery = z.infer<typeof sourceListQuerySchema>;
export type CreateSource = z.infer<typeof createSourceSchema>;
export type UpdateSource = z.infer<typeof updateSourceSchema>;
export type SourcePreviewJob = z.infer<typeof sourcePreviewJobSchema>;
export type SourceValidateResult = z.infer<typeof sourceValidateResultSchema>;
