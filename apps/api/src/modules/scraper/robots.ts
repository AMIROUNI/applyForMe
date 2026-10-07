import { fetchText } from './http';

interface RobotsRules {
  disallow: string[];
  allow: string[];
}

const cache = new Map<string, Promise<RobotsRules>>();

const parseRules = (body: string): RobotsRules => {
  const rules: RobotsRules = { disallow: [], allow: [] };
  let appliesToUs = false;
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      appliesToUs = value === '*' || value.toLowerCase().includes('applyforme');
      continue;
    }
    if (!appliesToUs) continue;
    if (key === 'disallow' && value) rules.disallow.push(value);
    if (key === 'allow' && value) rules.allow.push(value);
  }
  return rules;
};

const load = (origin: string): Promise<RobotsRules> => {
  const cached = cache.get(origin);
  if (cached) return cached;
  const promise = fetchText(`${origin}/robots.txt`).then(
    body => parseRules(body),
    () => ({ disallow: [], allow: [] }) satisfies RobotsRules
  );
  cache.set(origin, promise);
  return promise;
};

const blockedBy = (rules: RobotsRules, path: string): boolean => {
  let best = '';
  let blocked = false;
  for (const pattern of rules.allow) {
    if (path.startsWith(pattern) && pattern.length > best.length) {
      best = pattern;
      blocked = false;
    }
  }
  for (const pattern of rules.disallow) {
    if (path.startsWith(pattern) && pattern.length > best.length) {
      best = pattern;
      blocked = true;
    }
  }
  return blocked;
};

export async function canFetch(url: string): Promise<void> {
  const parsed = new URL(url);
  const rules = await load(parsed.origin);
  if (blockedBy(rules, parsed.pathname)) {
    throw new Error(`robots.txt disallows ${parsed.pathname} on ${parsed.origin}`);
  }
}

/** Test helper: clear the robots.txt cache. */
export function clearRobotsCache(): void {
  cache.clear();
}
