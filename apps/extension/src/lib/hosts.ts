export const SOURCE_HOSTS: Record<string, readonly string[]> = {
  linkedin_jobs: ['www.linkedin.com', 'linkedin.com'],
  linkedin_posts: ['www.linkedin.com', 'linkedin.com'],
  indeed: [
    'www.indeed.com',
    'indeed.com',
    'ca.indeed.com',
    'uk.indeed.com',
    'fr.indeed.com',
    'de.indeed.com',
  ],
};

export const hostOf = (value: string): string | null => {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
};

export const isKnownSource = (source: string): boolean => source in SOURCE_HOSTS;

export const isSupportedSearchUrl = (source: string, url: string): boolean => {
  const host = hostOf(url);
  if (!host) return false;
  return (SOURCE_HOSTS[source] ?? []).includes(host);
};
