import type { SourceConfig, SourceExecutionMode, SourceType } from '@agency-apply/shared';

export type RemoteType = 'onsite' | 'hybrid' | 'remote';
export type JobType = 'all' | 'full-time' | 'part-time' | 'contract' | 'internship';
export type ExperienceLevel = 'all' | 'entry' | 'mid' | 'senior' | 'lead' | 'executive';

export interface NormalizedJob {
  sourceId: string;
  sourceName: string;
  title: string;
  company: string;
  location: string;
  country: string;
  description: string;
  url: string;
  postedAt: Date;
  remoteType: RemoteType;
  jobType: JobType;
  experienceLevel: ExperienceLevel;
  skills: string[];
  salary: { min: number; max: number; currency: string; period: 'hour' | 'month' | 'year' } | null;
  applyMethod: 'external';
}

export interface ScrapeParams {
  keywords: string[];
  countries: string[];
  remoteOnly: boolean;
}

export interface SourceAdapter {
  id: string;
  name: string;
  scrape(params: ScrapeParams): Promise<NormalizedJob[]>;
}

/** Per-run secrets handed to adapter factories; never persisted on a source. */
export type AdapterContext = Record<string, unknown>;

/** A source as stored in the `job_sources` registry, reduced to what a resolver/adapter needs. */
export interface RegistrySource {
  id: string;
  name: string;
  baseUrl: string;
  type: SourceType;
  remoteFriendly: boolean;
  config: SourceConfig;
  requiresUserToken: boolean;
  executionMode: SourceExecutionMode;
  requiresExtension: boolean;
}
