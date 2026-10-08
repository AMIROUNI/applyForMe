import { z } from 'zod';
import { experienceLevelSchema, jobTypeSchema, remoteTypeSchema, salarySchema } from './job.dto';

export const scraperRunStatusSchema = z.enum(['queued', 'running', 'done', 'failed']);

export const scraperRunStartSchema = z.object({
  sources: z.array(z.string().min(1)).max(20).default([]),
  keywords: z.array(z.string().min(1).max(60)).max(20).default([]),
  countries: z.array(z.string().min(2).max(2)).max(20).default([]),
  remoteOnly: z.boolean().default(false),
});

export const scraperProgressSchema = z.object({
  total: z.number().int().min(0),
  done: z.number().int().min(0),
  found: z.number().int().min(0),
});

export const scraperRunErrorSchema = z.object({
  source: z.string(),
  message: z.string(),
});

export const extensionTaskStatusSchema = z.enum([
  'pending',
  'running',
  'done',
  'blocked',
  'failed',
  'skipped',
  'cancelled',
]);

export const extensionTaskTerminalStatuses = [
  'done',
  'blocked',
  'failed',
  'skipped',
  'cancelled',
] as const;

export type ExtensionTaskStatus = z.infer<typeof extensionTaskStatusSchema>;
export type ExtensionTaskAction = z.infer<typeof extensionTaskActionSchema>['action'];

export const isTerminalExtensionTaskStatus = (status: ExtensionTaskStatus): boolean =>
  (extensionTaskTerminalStatuses as readonly string[]).includes(status);

export const extensionTaskSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  status: extensionTaskStatusSchema,
  searchUrl: z.string().max(1000),
  pagesCaptured: z.number().int().min(0),
  itemsFound: z.number().int().min(0),
  message: z.string().max(500),
  startedAt: z.date().or(z.string()).nullable(),
  finishedAt: z.date().or(z.string()).nullable(),
});

export const extensionTaskUpdateSchema = z
  .object({
    status: extensionTaskStatusSchema.optional(),
    pagesCaptured: z.number().int().min(0).max(50).optional(),
    itemsFound: z.number().int().min(0).max(10_000).optional(),
    message: z.string().max(500).optional(),
  })
  .refine(update => Object.values(update).some(value => value !== undefined), {
    message: 'Update must change at least one field',
  });

export const extensionTaskActionSchema = z.object({
  action: z.enum(['cancel', 'skip', 'retry']),
});

export const scraperRunSchema = z.object({
  id: z.string(),
  status: scraperRunStatusSchema,
  sources: z.array(z.string()),
  keywords: z.array(z.string()),
  countries: z.array(z.string()),
  remoteOnly: z.boolean(),
  progress: scraperProgressSchema,
  errors: z.array(scraperRunErrorSchema),
  extensionTasks: z.array(extensionTaskSchema).default([]),
  startedAt: z.date().or(z.string()).nullable(),
  finishedAt: z.date().or(z.string()).nullable(),
});

/** One item parsed by the extension from a page the user can see. */
export const ingestJobItemSchema = z.object({
  title: z.string().trim().min(1).max(300),
  company: z.string().trim().max(200).default(''),
  url: z
    .string()
    .trim()
    .max(1000)
    .refine(value => /^https?:\/\/\S+$/i.test(value), 'Must be an http(s) URL'),
  location: z.string().trim().max(200).default(''),
  country: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{2}$/, 'Must be a 2-letter ISO country code')
    .optional(),
  description: z.string().max(20_000).default(''),
  postedAt: z.date().or(z.string()).optional(),
  skills: z.array(z.string().max(60)).max(30).default([]),
  remoteType: remoteTypeSchema.optional(),
  jobType: jobTypeSchema.optional(),
  experienceLevel: experienceLevelSchema.optional(),
  salary: salarySchema.nullable().optional(),
});

export const ingestJobsRequestSchema = z.object({
  runId: z.string().min(1).max(64).optional(),
  taskId: z.string().min(1).max(64),
  items: z.array(ingestJobItemSchema).min(1).max(50),
});

export const ingestJobsResponseSchema = z.object({
  ingested: z.number().int().min(0),
  found: z.number().int().min(0),
  taskStatus: extensionTaskStatusSchema.nullable(),
});

export type ScraperRunStatus = z.infer<typeof scraperRunStatusSchema>;
export type ScraperRunStart = z.infer<typeof scraperRunStartSchema>;
export type ScraperProgress = z.infer<typeof scraperProgressSchema>;
export type ScraperRunError = z.infer<typeof scraperRunErrorSchema>;
export type ScraperRun = z.infer<typeof scraperRunSchema>;
export type ExtensionTask = z.infer<typeof extensionTaskSchema>;
export type ExtensionTaskUpdate = z.infer<typeof extensionTaskUpdateSchema>;
export type IngestJobItem = z.infer<typeof ingestJobItemSchema>;
export type IngestJobsRequest = z.infer<typeof ingestJobsRequestSchema>;
export type IngestJobsResponse = z.infer<typeof ingestJobsResponseSchema>;

export const emptyScraperRunStart = (): ScraperRunStart => scraperRunStartSchema.parse({});
