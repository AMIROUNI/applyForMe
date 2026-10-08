import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type {
  DiscoverResult,
  DiscoverSources,
  DiscoveryCandidate,
  DiscoveryProposal,
} from '@agency-apply/shared';
import { assertSafeHttpUrl, assertSafeSourceConfig } from './url-guard';
import { resolveAdapter, unavailableReason, type RegistrySource } from '../scraper/adapters';
import { delay } from '../scraper/http';
import { LlmService } from './llm.service';
import { JobSource, emptyHealth, type JobSourceDocument } from './source.schema';
import { slugify } from './sources.service';

const MIN_JOBS = 3;
const PREVIEW_JOBS = 3;
const INTER_CANDIDATE_DELAY_MS = 500;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const buildConfig = (proposal: DiscoveryProposal): Record<string, unknown> => {
  const config: Record<string, unknown> = {};
  if (proposal.selectors && Object.keys(proposal.selectors).length > 0) {
    config['selectors'] = proposal.selectors;
  }
  if (proposal.feedUrls && proposal.feedUrls.length > 0) {
    config['feedUrls'] = proposal.feedUrls;
  }
  if (proposal.endpoint) config['endpoint'] = proposal.endpoint;
  return config;
};

/**
 * AI source discovery: the model proposes candidate sources, this service
 * validates each one deterministically (SSRF guard, registry dedupe, robots.txt
 * through the adapters, >= 3 parseable jobs) and only stores passing candidates
 * as `pending` sources. The LLM never produces final job data.
 */
@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    @InjectModel(JobSource.name) private readonly sourceModel: Model<JobSourceDocument>,
    private readonly llm: LlmService
  ) {}

  async discover(userId: string, dto: DiscoverSources): Promise<DiscoverResult> {
    const proposals = await this.llm.proposeSources(dto.country, dto.keywords);
    const known = await this.knownOrigins();

    const candidates: DiscoveryCandidate[] = [];
    for (const proposal of proposals) {
      if (candidates.length > 0) await delay(INTER_CANDIDATE_DELAY_MS);
      candidates.push(await this.evaluate(userId, proposal, dto.country, known));
    }

    const accepted = candidates.filter(candidate => candidate.ok).length;
    this.logger.log(`AI discovery (${dto.country}): ${accepted}/${candidates.length} accepted`);
    return { country: dto.country, candidates };
  }

  /** Origin -> source id for every registry entry, to reject duplicates. */
  private async knownOrigins(): Promise<Map<string, string>> {
    const docs = await this.sourceModel.find({}).exec();
    const known = new Map<string, string>();
    for (const doc of docs) {
      try {
        const origin = new URL(doc.baseUrl).origin;
        if (!known.has(origin)) known.set(origin, doc.id);
      } catch {
        // Empty or malformed baseUrl (legacy rows) can never collide.
      }
    }
    return known;
  }

  private async evaluate(
    userId: string,
    proposal: DiscoveryProposal,
    country: string,
    known: Map<string, string>
  ): Promise<DiscoveryCandidate> {
    const reject = (reason: string, sampleCount = 0): DiscoveryCandidate => ({
      name: proposal.name,
      baseUrl: proposal.baseUrl,
      type: proposal.type,
      ok: false,
      reason,
      sourceId: null,
      sampleCount,
      preview: [],
    });

    let origin: string;
    try {
      origin = assertSafeHttpUrl(proposal.baseUrl).origin;
    } catch (error) {
      return reject(errorMessage(error));
    }

    const existingId = known.get(origin);
    if (existingId) {
      return {
        name: proposal.name,
        baseUrl: proposal.baseUrl,
        type: proposal.type,
        ok: false,
        reason: 'Already in the registry',
        sourceId: existingId,
        sampleCount: 0,
        preview: [],
      };
    }

    const config = buildConfig(proposal);
    try {
      assertSafeSourceConfig(config);
    } catch (error) {
      return reject(errorMessage(error));
    }

    const entry: RegistrySource = {
      id: `discovery-${slugify(proposal.name)}`,
      name: proposal.name,
      baseUrl: proposal.baseUrl,
      type: proposal.type,
      remoteFriendly: true,
      config: config as RegistrySource['config'],
      requiresUserToken: false,
      executionMode: 'server',
      requiresExtension: false,
    };
    const adapter = resolveAdapter(entry, {});
    if (!adapter) return reject(unavailableReason(entry, {}));

    let jobs;
    try {
      jobs = await adapter.scrape({ keywords: [], countries: [], remoteOnly: false });
    } catch (error) {
      return reject(errorMessage(error));
    }
    if (jobs.length < MIN_JOBS) {
      return reject(
        `Only ${jobs.length} parseable job(s) found - at least ${MIN_JOBS} required`,
        jobs.length
      );
    }

    const id = await this.uniqueId(slugify(proposal.name));
    const doc = await this.sourceModel.create({
      id,
      name: proposal.name,
      description: proposal.why || 'Proposed by AI source discovery.',
      baseUrl: proposal.baseUrl,
      type: proposal.type,
      countries: [country],
      categories: [],
      remoteFriendly: true,
      status: 'pending',
      config,
      requiresUserToken: false,
      health: emptyHealth(),
      addedBy: 'ai',
      ownerId: userId,
    });
    known.set(origin, doc.id);

    return {
      name: proposal.name,
      baseUrl: proposal.baseUrl,
      type: proposal.type,
      ok: true,
      reason: 'Added as a pending source - validate it to activate',
      sourceId: doc.id,
      sampleCount: jobs.length,
      preview: jobs.slice(0, PREVIEW_JOBS).map(job => ({
        title: job.title,
        company: job.company,
        location: job.location,
        url: job.url,
        postedAt: job.postedAt,
      })),
    };
  }

  private async uniqueId(base: string): Promise<string> {
    for (let suffix = 1; suffix <= 50; suffix += 1) {
      const candidate = suffix === 1 ? base : `${base}-${suffix}`;
      const exists = await this.sourceModel.findOne({ id: candidate }).exec();
      if (!exists) return candidate;
    }
    return `${base}-${Date.now().toString(36)}`;
  }
}
