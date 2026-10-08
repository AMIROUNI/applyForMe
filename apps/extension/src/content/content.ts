import { ingestJobItemSchema, type IngestJobItem } from '@agency-apply/shared';
import { detectBlocked } from '../lib/blocked';
import type { ExtractRequest, ExtractResponse } from '../lib/messages';
import { createDomPage, parsePage } from '../lib/parse';

const MAX_ITEMS = 50;

const handleExtract = (request: ExtractRequest): ExtractResponse => {
  const blocked = detectBlocked({
    url: location.href,
    text: document.body?.innerText.slice(0, 100_000) ?? '',
  });
  if (blocked) return { kind: 'blocked', message: blocked.message };

  const parsed = parsePage(request.source, createDomPage(document));
  const items: IngestJobItem[] = [];
  for (const raw of parsed.items) {
    const result = ingestJobItemSchema.safeParse(raw);
    if (result.success) items.push(result.data);
    if (items.length >= MAX_ITEMS) break;
  }
  return { kind: 'items', items, nextUrl: parsed.nextUrl };
};

chrome.runtime.onMessage.addListener((request: unknown, _sender, sendResponse): boolean => {
  const message = request as ExtractRequest | null;
  if (!message || message.type !== 'extract') return false;
  try {
    sendResponse(handleExtract(message));
  } catch (error) {
    sendResponse({
      kind: 'error',
      message: error instanceof Error ? error.message : 'Could not read the page',
    } satisfies ExtractResponse);
  }
  return false;
});
