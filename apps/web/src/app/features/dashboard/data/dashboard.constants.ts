import type { DatePosted, ExperienceLevel, JobStatus, JobType, RemoteType } from '@shared';
import type { MultiSelectOption } from '../../../shared/ui/multi-select/multi-select.component';

export interface LabelledOption extends MultiSelectOption {
  labelKey: string;
  browser?: boolean;
}

export const COUNTRY_OPTIONS: LabelledOption[] = [
  { value: 'tn', label: 'Tunisia', labelKey: 'country.tn' },
  { value: 'fr', label: 'France', labelKey: 'country.fr' },
  { value: 'ma', label: 'Morocco', labelKey: 'country.ma' },
  { value: 'dz', label: 'Algeria', labelKey: 'country.dz' },
  { value: 'us', label: 'United States', labelKey: 'country.us' },
  { value: 'gb', label: 'United Kingdom', labelKey: 'country.gb' },
  { value: 'de', label: 'Germany', labelKey: 'country.de' },
  { value: 'ca', label: 'Canada', labelKey: 'country.ca' },
  { value: 'ae', label: 'United Arab Emirates', labelKey: 'country.ae' },
];

export const STATUS_OPTIONS: LabelledOption[] = (
  ['new', 'saved', 'applied', 'skipped'] as JobStatus[]
).map((value) => ({ value, label: value, labelKey: `filters.status.${value}` }));

export const EXPERIENCE_OPTIONS: LabelledOption[] = (
  ['entry', 'mid', 'senior', 'lead', 'executive'] as ExperienceLevel[]
).map((value) => ({ value, label: value, labelKey: `filters.experience.${value}` }));

export const REMOTE_OPTIONS: LabelledOption[] = (
  ['remote', 'hybrid', 'onsite'] as RemoteType[]
).map((value) => ({ value, label: value, labelKey: `filters.remote.${value}` }));

export const JOB_TYPE_OPTIONS: LabelledOption[] = (
  ['full-time', 'part-time', 'contract', 'internship'] as JobType[]
).map((value) => ({ value, label: value, labelKey: `filters.jobType.${value}` }));

export const DATE_POSTED_OPTIONS: LabelledOption[] = (
  ['last-24h', 'last-week', 'last-month', 'last-3-months', 'all'] as DatePosted[]
).map((value) => ({ value, label: value, labelKey: `filters.datePosted.${value}` }));

export const MIN_SCORE_OPTIONS: LabelledOption[] = [
  { value: '', label: 'Any score', labelKey: 'filters.minScore.any' },
  { value: '50', label: '50+', labelKey: 'filters.minScore.50' },
  { value: '70', label: '70+', labelKey: 'filters.minScore.70' },
  { value: '85', label: '85+', labelKey: 'filters.minScore.85' },
];

export const SOURCE_OPTIONS: LabelledOption[] = [
  { value: 'remotive', label: 'Remotive', labelKey: 'source.remotive' },
  { value: 'remoteok', label: 'RemoteOK', labelKey: 'source.remoteok' },
  { value: 'arbeitnow', label: 'Arbeitnow', labelKey: 'source.arbeitnow' },
  { value: 'weworkremotely', label: 'We Work Remotely', labelKey: 'source.wwr' },
  { value: 'emploi_nat_tn', label: 'Emploi.nat.tn', labelKey: 'source.emploiNat', disabled: true },
  { value: 'tanitjobs', label: 'TanitJobs', labelKey: 'source.tanitjobs', disabled: true },
  { value: 'keepjob', label: 'KeepJob', labelKey: 'source.keepjob', disabled: true },
  {
    value: 'linkedin_jobs',
    label: 'LinkedIn Jobs',
    labelKey: 'source.linkedinJobs',
    browser: true,
  },
  {
    value: 'linkedin_posts',
    label: 'LinkedIn hiring posts',
    labelKey: 'source.linkedinPosts',
    browser: true,
  },
  { value: 'indeed', label: 'Indeed', labelKey: 'source.indeed', browser: true },
];
