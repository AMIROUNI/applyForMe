import { z } from 'zod';

export const jobStatusSchema = z.enum(['new', 'saved', 'applied', 'skipped']);
export const applyMethodSchema = z.enum(['easy', 'external', 'email', 'manual']);
export const experienceLevelSchema = z.enum(['entry', 'mid', 'senior', 'lead', 'executive', 'all']);
export const remoteTypeSchema = z.enum(['remote', 'hybrid', 'onsite', 'all']);
export const jobTypeSchema = z.enum(['full-time', 'part-time', 'contract', 'internship', 'all']);
export const datePostedSchema = z.enum([
  'last-24h',
  'last-week',
  'last-month',
  'last-3-months',
  'all',
]);
export const salaryPeriodSchema = z.enum(['year', 'month', 'hour']);

export const salarySchema = z.object({
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
  currency: z.string().min(1),
  period: salaryPeriodSchema,
});

export const jobSchema = z.object({
  id: z.string(),
  urlHash: z.string(),
  sourceId: z.string(),
  sourceName: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  country: z.string(),
  description: z.string(),
  url: z.string().url(),
  postedAt: z.date().or(z.string()),
  scrapedAt: z.date().or(z.string()),
  experienceLevel: experienceLevelSchema,
  remoteType: remoteTypeSchema,
  jobType: jobTypeSchema,
  salary: salarySchema.nullable().optional(),
  skills: z.array(z.string()).default([]),
  applyMethod: applyMethodSchema,
  matchScore: z.number().min(0).max(100),
  matchReason: z.string().default(''),
  status: jobStatusSchema,
});

export const jobFiltersSchema = z.object({
  countries: z.array(z.string()).default([]),
  sources: z.array(z.string()).default([]),
  statuses: z.array(jobStatusSchema).default([]),
  experienceLevels: z.array(experienceLevelSchema).default([]),
  remoteTypes: z.array(remoteTypeSchema).default([]),
  jobTypes: z.array(jobTypeSchema).default([]),
  minScore: z.number().min(0).max(100).nullable().default(null),
  datePosted: datePostedSchema.default('all'),
});

export const jobSortSchema = z.enum(['matchScore', 'postedAt', 'company']);

export const jobSearchRequestSchema = z.object({
  query: z.string().default(''),
  filters: jobFiltersSchema.default({}),
  sort: jobSortSchema.default('matchScore'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const jobSearchMetaSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
});

export const jobSearchResponseSchema = z.object({
  data: z.array(jobSchema),
  meta: jobSearchMetaSchema,
});

export type JobStatus = z.infer<typeof jobStatusSchema>;
export type ApplyMethod = z.infer<typeof applyMethodSchema>;
export type ExperienceLevel = z.infer<typeof experienceLevelSchema>;
export type RemoteType = z.infer<typeof remoteTypeSchema>;
export type JobType = z.infer<typeof jobTypeSchema>;
export type DatePosted = z.infer<typeof datePostedSchema>;
export type Salary = z.infer<typeof salarySchema>;
export type Job = z.infer<typeof jobSchema>;
export type JobFilters = z.infer<typeof jobFiltersSchema>;
export type JobSort = z.infer<typeof jobSortSchema>;
export type JobSearchRequest = z.infer<typeof jobSearchRequestSchema>;
export type JobSearchMeta = z.infer<typeof jobSearchMetaSchema>;
export type JobSearchResponse = z.infer<typeof jobSearchResponseSchema>;

export const emptyJobFilters = (): JobFilters => jobFiltersSchema.parse({});
