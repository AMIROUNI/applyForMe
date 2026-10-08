export const PAGE_CAP = 3;
export const DELAY_MIN_MS = 2000;
export const DELAY_MAX_MS = 5000;
export const LOAD_TIMEOUT_MS = 30_000;
export const EXTRACT_ATTEMPTS = 3;
export const EXTRACT_RETRY_MS = 300;
export const MAX_INGEST_ITEMS = 50;
export const DEFAULT_API_BASE = 'http://localhost:3000/api/v1';

export const randomDelayMs = (rng: () => number): number =>
  Math.floor(DELAY_MIN_MS + rng() * (DELAY_MAX_MS - DELAY_MIN_MS));
