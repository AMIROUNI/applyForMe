import { z } from 'zod';
import { sourcePreviewJobSchema } from './source.dto';

/**
 * One candidate the model proposed during AI source discovery. The model only
 * ever proposes - every field is re-validated here and every candidate still
 * passes the deterministic reachability/extractability checks before a source
 * is created.
 */
export const discoveryProposalSchema = z.object({
  name: z.string().trim().min(2).max(80),
  baseUrl: z
    .string()
    .trim()
    .max(300)
    .regex(/^https?:\/\/\S+$/i, 'Must be an http(s) URL'),
  type: z.enum(['html', 'rss', 'api']),
  why: z.string().trim().max(240).default(''),
  selectors: z.record(z.string().trim().min(1).max(300)).optional(),
  feedUrls: z.array(z.string().trim().min(1).max(500)).max(5).optional(),
  endpoint: z.string().trim().min(1).max(500).optional(),
});

export const discoverSourcesSchema = z.object({
  country: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{2}$/, 'Must be a 2-letter ISO country code'),
  keywords: z.array(z.string().trim().min(1).max(60)).max(5).default([]),
});

export const discoveryCandidateSchema = z.object({
  name: z.string(),
  baseUrl: z.string(),
  type: z.enum(['html', 'rss', 'api']),
  ok: z.boolean(),
  reason: z.string(),
  sourceId: z.string().nullable(),
  sampleCount: z.number().int().min(0),
  preview: z.array(sourcePreviewJobSchema),
});

export const discoverResultSchema = z.object({
  country: z.string(),
  candidates: z.array(discoveryCandidateSchema),
});

export type DiscoveryProposal = z.infer<typeof discoveryProposalSchema>;
export type DiscoverSources = z.infer<typeof discoverSourcesSchema>;
export type DiscoveryCandidate = z.infer<typeof discoveryCandidateSchema>;
export type DiscoverResult = z.infer<typeof discoverResultSchema>;
