import { z } from 'zod';

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

export const scraperRunSchema = z.object({
  id: z.string(),
  status: scraperRunStatusSchema,
  sources: z.array(z.string()),
  keywords: z.array(z.string()),
  countries: z.array(z.string()),
  remoteOnly: z.boolean(),
  progress: scraperProgressSchema,
  errors: z.array(scraperRunErrorSchema),
  startedAt: z.date().or(z.string()).nullable(),
  finishedAt: z.date().or(z.string()).nullable(),
});

export type ScraperRunStatus = z.infer<typeof scraperRunStatusSchema>;
export type ScraperRunStart = z.infer<typeof scraperRunStartSchema>;
export type ScraperProgress = z.infer<typeof scraperProgressSchema>;
export type ScraperRunError = z.infer<typeof scraperRunErrorSchema>;
export type ScraperRun = z.infer<typeof scraperRunSchema>;

export const emptyScraperRunStart = (): ScraperRunStart => scraperRunStartSchema.parse({});
