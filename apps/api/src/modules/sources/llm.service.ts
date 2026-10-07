import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { discoveryProposalSchema, type DiscoveryProposal } from '@agency-apply/shared';
import { fetchJson } from '../scraper/http';

const MAX_PROPOSALS = 6;
const LLM_TIMEOUT_MS = 30_000;

/** Groq JSON mode only allows object envelopes, so the list lives in `sources`. */
const envelopeSchema = z.object({ sources: z.array(z.unknown()) });

const SYSTEM_PROMPT = [
  'You propose public job-board sources for a country. The caller validates every',
  'candidate deterministically (robots.txt, SSRF, extractability) - only valid',
  'candidates are used, so never guess or invent URLs.',
  'Prefer boards exposing JSON-LD, RSS/Atom feeds, public JSON APIs or simple HTML',
  'job lists without login walls or anti-bot walls.',
  'For html you may include CSS selectors for the list page (item, title, link,',
  'company, location, date); for rss include feedUrls; for api include endpoint.',
  'Return JSON only: {"sources":[{"name":"...","baseUrl":"https://...","type":"html|rss|api","why":"one short sentence","selectors":{},"feedUrls":["..."],"endpoint":"https://..."}]}',
].join(' ');

const userPrompt = (country: string, keywords: string[]): string =>
  [
    `Country: ${country.toUpperCase()}`,
    keywords.length ? `Focus keywords: ${keywords.join(', ')}` : '',
    `Propose up to ${MAX_PROPOSALS} sources.`,
  ]
    .filter(Boolean)
    .join('\n');

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Asks Groq for candidate sources. Every proposal is re-validated with zod and
   * invalid entries are dropped - the model never produces final job data, it
   * only narrows the search space for the deterministic validator.
   */
  async proposeSources(country: string, keywords: string[]): Promise<DiscoveryProposal[]> {
    const apiKey = this.config.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: 'AI_DISCOVERY_UNCONFIGURED',
        message: 'AI source discovery needs a GROQ_API_KEY in the environment',
      });
    }

    const baseUrl = this.config.get<string>('GROQ_BASE_URL') ?? 'https://api.groq.com/openai/v1';
    const model = this.config.get<string>('GROQ_MODEL') ?? 'llama-3.3-70b-versatile';

    let payload: unknown;
    try {
      payload = await fetchJson<unknown>(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt(country, keywords) },
          ],
        }),
        signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      });
    } catch (error) {
      // The key travels in the Authorization header - never log the request.
      this.logger.warn(`Groq request failed: ${errorMessage(error)}`);
      throw new BadGatewayException({
        statusCode: 502,
        code: 'AI_DISCOVERY_FAILED',
        message: `AI source discovery request failed: ${errorMessage(error)}`,
      });
    }

    try {
      const content = completionContent(payload);
      const envelope = envelopeSchema.parse(JSON.parse(content));
      const proposals: DiscoveryProposal[] = [];
      for (const raw of envelope.sources) {
        const parsed = discoveryProposalSchema.safeParse(raw);
        if (parsed.success) {
          proposals.push(parsed.data);
        } else {
          const first = parsed.error.issues[0];
          this.logger.warn(
            `Dropped invalid AI proposal (${first?.path.join('.')}: ${first?.message})`
          );
        }
      }
      return proposals.slice(0, MAX_PROPOSALS);
    } catch (error) {
      this.logger.warn(`Groq returned an unreadable completion: ${errorMessage(error)}`);
      throw new BadGatewayException({
        statusCode: 502,
        code: 'AI_DISCOVERY_BAD_OUTPUT',
        message: 'The model returned an unreadable response',
      });
    }
  }
}

const completionContent = (payload: unknown): string => {
  const record = payload as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = record?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('completion has no string content');
  }
  return content;
};
