/** Resolves a possibly relative href against the source base URL. Empty when unusable. */
export function absoluteUrl(href: string | undefined | null, base: string): string {
  const raw = (href ?? '').trim();
  if (!raw) return '';
  try {
    return new URL(raw, base || undefined).toString();
  } catch {
    return '';
  }
}

/** Accepts Date, epoch seconds/millis, or ISO-ish strings; falls back to "now". */
export function parsePostDate(raw: unknown): Date {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? new Date() : raw;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return new Date(raw > 1e12 ? raw : raw * 1000);
  }
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

/**
 * Feed titles rarely carry a structured company, so the best we can do is a
 * conventional split: "Title | Company" or "Company: Title". Anything else
 * keeps the honest "Unknown" company.
 */
export function splitHeading(raw: string): { company: string; title: string } {
  const text = raw.replace(/\s+/g, ' ').trim();
  const pipe = text.indexOf(' | ');
  if (pipe > 0) {
    return { title: text.slice(0, pipe).trim(), company: text.slice(pipe + 3).trim() };
  }
  const colon = text.indexOf(': ');
  if (colon > 0) {
    return { company: text.slice(0, colon).trim(), title: text.slice(colon + 2).trim() };
  }
  return { company: 'Unknown', title: text };
}
