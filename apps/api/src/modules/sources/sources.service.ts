import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type {
  CreateSource,
  JobSource as JobSourceDto,
  SourceListQuery,
  SourceValidateResult,
  UpdateSource,
} from '@agency-apply/shared';
import { fetchText } from '../scraper/http';
import { canFetch } from '../scraper/robots';
import {
  adapterById,
  resolveAdapter,
  unavailableReason,
  type AdapterContext,
  type RegistrySource,
} from '../scraper/adapters';
import { ProviderKeysService } from '../provider-keys/provider-keys.service';
import { SOURCE_SEED, type SeedSource } from './seed/source-seed.data';
import { JobSource, emptyHealth, type JobSourceDocument } from './source.schema';
import { assertSafeHttpUrl, assertSafeSourceConfig } from './url-guard';

const SAMPLE_SIZE = 3;
const ACTIVATION_THRESHOLD = 3;

export interface ResolveResult {
  usable: RegistrySource[];
  rejected: Array<{ source: string; reason: string }>;
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'source';

@Injectable()
export class SourcesService implements OnModuleInit {
  private readonly logger = new Logger(SourcesService.name);

  constructor(
    @InjectModel(JobSource.name) private readonly sourceModel: Model<JobSourceDocument>,
    private readonly providerKeys: ProviderKeysService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSeeded();
  }

  /** Seeds the curated registry on first boot; explicit runs use `seed:sources`. */
  async ensureSeeded(): Promise<void> {
    try {
      const count = await this.sourceModel.countDocuments().exec();
      if (count > 0) return;
      await this.sourceModel.insertMany(SOURCE_SEED.map(toDoc), { ordered: false });
      this.logger.log(`Seeded ${SOURCE_SEED.length} job sources`);
    } catch (error) {
      this.logger.warn(`Could not seed job sources: ${errorMessage(error)}`);
    }
  }

  async list(query: SourceListQuery = {}): Promise<JobSourceDto[]> {
    const filter: Record<string, unknown> = {};
    if (query.country) filter.countries = { $in: [query.country, '*'] };
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;

    const docs = await this.sourceModel.find(filter).sort({ status: 1, name: 1 }).exec();
    return docs.map(toDto);
  }

  async get(id: string): Promise<JobSourceDto> {
    const doc = await this.sourceModel.findOne({ id }).exec();
    if (!doc) throw this.notFound(id);
    return toDto(doc);
  }

  /** Active, runnable source ids — used when a run does not pick any source. */
  async defaultIds(): Promise<string[]> {
    return (await this.list({ status: 'active' }))
      .filter(source => !source.requiresUserToken)
      .map(source => source.id);
  }

  /**
   * Registry-driven resolution: requested ids -> adapter instances, plus a
   * per-source reason for everything that cannot run. `ctx` carries the
   * user's provider tokens so `requiresUserToken` sources can resolve.
   * Falls back to the legacy in-code adapter map when never seeded.
   */
  async resolve(ids: string[], ctx: AdapterContext = {}): Promise<ResolveResult> {
    const requested = ids.length ? ids : await this.defaultIds();
    const docs = await this.sourceModel.find({ id: { $in: requested } }).exec();

    if (!docs.length) {
      return this.legacyResolve(requested);
    }

    const byId = new Map(docs.map(doc => [doc.id, doc]));
    const usable: RegistrySource[] = [];
    const rejected: Array<{ source: string; reason: string }> = [];

    for (const id of requested) {
      const doc = byId.get(id);
      if (!doc) {
        rejected.push({ source: id, reason: 'Unknown source' });
        continue;
      }
      const entry = toRegistry(doc);
      if (doc.status === 'disabled') {
        rejected.push({ source: id, reason: inactiveReason(doc.status) });
        continue;
      }
      const tokenOk = entry.type === 'apify' ? Boolean(ctx.apifyToken) : false;
      if (entry.requiresUserToken && !tokenOk) {
        rejected.push({ source: id, reason: unavailableReason(entry, ctx) });
        continue;
      }
      if (doc.status !== 'active') {
        rejected.push({ source: id, reason: inactiveReason(doc.status) });
        continue;
      }
      if (!resolveAdapter(entry, ctx)) {
        rejected.push({ source: id, reason: unavailableReason(entry, ctx) });
        continue;
      }
      usable.push(entry);
    }

    return { usable, rejected };
  }

  /** Health bookkeeping called by the scraper after each source finishes. */
  async recordOutcome(id: string, ok: boolean, latencyMs: number): Promise<void> {
    try {
      const doc = await this.sourceModel.findOne({ id }).exec();
      if (!doc) return;
      if (ok) {
        await this.recordSuccess(doc, latencyMs);
      } else {
        await this.recordFailure(doc);
      }
    } catch (error) {
      this.logger.warn(`Could not record health for ${id}: ${errorMessage(error)}`);
    }
  }

  async create(userId: string, dto: CreateSource): Promise<JobSourceDto> {
    assertSafeHttpUrl(dto.baseUrl);
    assertSafeSourceConfig(dto.config);
    const id = await this.uniqueId(slugify(dto.name));

    const doc = await this.sourceModel.create({
      id,
      name: dto.name,
      description: dto.description ?? '',
      baseUrl: dto.baseUrl,
      type: dto.type,
      countries: dto.countries,
      categories: dto.categories,
      remoteFriendly: dto.remoteFriendly,
      config: dto.config ?? {},
      requiresUserToken: false,
      status: 'pending',
      addedBy: 'user',
      ownerId: userId,
      health: emptyHealth(),
    });
    return toDto(doc);
  }

  async patch(userId: string, id: string, dto: UpdateSource): Promise<JobSourceDto> {
    const doc = await this.sourceModel.findOne({ id }).exec();
    if (!doc) throw this.notFound(id);
    if (doc.addedBy !== 'user' || doc.ownerId !== userId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'SOURCE_READ_ONLY',
        message: 'Only sources you added can be edited',
      });
    }

    if (dto.baseUrl !== undefined) assertSafeHttpUrl(dto.baseUrl);
    if (dto.config !== undefined) assertSafeSourceConfig(dto.config);
    for (const key of [
      'name',
      'description',
      'baseUrl',
      'countries',
      'categories',
      'remoteFriendly',
      'config',
      'status',
    ] as const) {
      const value = dto[key];
      if (value !== undefined) (doc as unknown as Record<string, unknown>)[key] = value;
    }
    await doc.save();
    return toDto(doc);
  }

  /**
   * Dry run: fetch a sample through the source's adapter (or probe reachability
   * when no adapter exists yet), record health and preview up to 3 jobs.
   * Apify sources need the user's connected token; without it we refuse
   * instead of probing a site we are not allowed to scrape directly.
   */
  async validate(userId: string, id: string): Promise<SourceValidateResult> {
    const doc = await this.sourceModel.findOne({ id }).exec();
    if (!doc) throw this.notFound(id);

    const entry = toRegistry(doc);
    const apifyToken =
      entry.type === 'apify' ? await this.providerKeys.getDecrypted(userId, 'apify') : null;
    const ctx: AdapterContext = { apifyToken };
    const adapter = resolveAdapter(entry, ctx);
    const startedAt = Date.now();

    if (entry.requiresUserToken && !ctx.apifyToken) {
      return this.notRunnable(doc, unavailableReason(entry, ctx));
    }

    try {
      assertSafeHttpUrl(doc.baseUrl);
      assertSafeSourceConfig(doc.config as Record<string, unknown> | null);

      if (!adapter) {
        if (entry.type === 'apify' || entry.type === 'ai_extract') {
          return this.notRunnable(doc, unavailableReason(entry, ctx));
        }
        await canFetch(doc.baseUrl);
        await fetchText(doc.baseUrl);
        const latencyMs = Date.now() - startedAt;
        await this.recordSuccess(doc, latencyMs);
        return {
          id: doc.id,
          ok: true,
          reachable: true,
          runnable: false,
          message: `Reachable — no adapter can parse "${doc.type}" sources yet`,
          latencyMs,
          sampleCount: 0,
          preview: [],
          status: doc.status,
          health: doc.health,
        };
      }

      const jobs = await adapter.scrape({ keywords: [], countries: [], remoteOnly: false });
      const latencyMs = Date.now() - startedAt;
      const preview = jobs.slice(0, SAMPLE_SIZE).map(job => ({
        title: job.title,
        company: job.company,
        location: job.location,
        url: job.url,
        postedAt: job.postedAt,
      }));

      if (preview.length >= ACTIVATION_THRESHOLD && doc.status === 'pending') {
        doc.status = 'active';
      }
      await this.recordSuccess(doc, latencyMs);

      return {
        id: doc.id,
        ok: true,
        reachable: true,
        runnable: true,
        message:
          preview.length > 0
            ? `Found ${jobs.length} job(s), showing the first ${preview.length}`
            : 'Adapter responded but returned no jobs for these filters',
        latencyMs,
        sampleCount: jobs.length,
        preview,
        status: doc.status,
        health: doc.health,
      };
    } catch (error) {
      const message = errorMessage(error);
      const latencyMs = Date.now() - startedAt;
      await this.recordFailure(doc);
      return {
        id: doc.id,
        ok: false,
        reachable: false,
        runnable: Boolean(adapter),
        message,
        latencyMs,
        sampleCount: 0,
        preview: [],
        status: doc.status,
        health: doc.health,
      };
    }
  }

  /** Legacy safety net: registry empty -> behave exactly like the old code. */
  private legacyResolve(ids: string[]): ResolveResult {
    const usable: RegistrySource[] = [];
    const rejected: Array<{ source: string; reason: string }> = [];
    for (const id of ids) {
      const adapter = adapterById.get(id);
      if (!adapter) {
        rejected.push({ source: id, reason: 'Unknown source' });
        continue;
      }
      usable.push({
        id,
        name: adapter.name,
        baseUrl: '',
        type: 'api',
        remoteFriendly: true,
        config: { adapterId: id },
        requiresUserToken: false,
      });
    }
    return { usable, rejected };
  }

  private async uniqueId(base: string): Promise<string> {
    for (let suffix = 1; suffix <= 50; suffix += 1) {
      const candidate = suffix === 1 ? base : `${base}-${suffix}`;
      const exists = await this.sourceModel.findOne({ id: candidate }).exec();
      if (!exists) return candidate;
    }
    throw new ConflictException({
      statusCode: 409,
      code: 'SOURCE_ID_TAKEN',
      message: 'Too many sources share this name',
    });
  }

  private async recordSuccess(doc: JobSourceDocument, latencyMs: number): Promise<void> {
    const previous = doc.health?.avgLatencyMs ?? null;
    doc.health = {
      lastSuccessAt: new Date(),
      lastErrorAt: doc.health?.lastErrorAt ?? null,
      failureCount: 0,
      avgLatencyMs: previous === null ? latencyMs : Math.round((previous + latencyMs) / 2),
    };
    await doc.save();
  }

  private async recordFailure(doc: JobSourceDocument): Promise<void> {
    doc.health = {
      lastSuccessAt: doc.health?.lastSuccessAt ?? null,
      lastErrorAt: new Date(),
      failureCount: (doc.health?.failureCount ?? 0) + 1,
      avgLatencyMs: doc.health?.avgLatencyMs ?? null,
    };
    await doc.save();
  }

  private notFound(id: string): NotFoundException {
    return new NotFoundException({
      statusCode: 404,
      code: 'SOURCE_NOT_FOUND',
      message: `Source "${id}" not found`,
    });
  }

  /** Validation refusal that must not touch the source's health record. */
  private notRunnable(doc: JobSourceDocument, message: string): SourceValidateResult {
    return {
      id: doc.id,
      ok: false,
      reachable: false,
      runnable: false,
      message,
      latencyMs: null,
      sampleCount: 0,
      preview: [],
      status: doc.status,
      health: doc.health,
    };
  }
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const inactiveReason = (status: string): string => {
  if (status === 'disabled') return 'Source is disabled';
  if (status === 'broken') return 'Source is failing and was taken out of runs';
  if (status === 'pending') return 'Source is awaiting validation';
  return `Source is ${status}`;
};

export function toRegistry(doc: JobSourceDocument): RegistrySource {
  return {
    id: doc.id,
    name: doc.name,
    baseUrl: doc.baseUrl,
    type: doc.type,
    remoteFriendly: Boolean(doc.remoteFriendly),
    config: (doc.config ?? {}) as RegistrySource['config'],
    requiresUserToken: Boolean(doc.requiresUserToken),
  };
}

export function toDto(doc: JobSourceDocument): JobSourceDto {
  return {
    id: doc.id,
    name: doc.name,
    description: doc.description ?? '',
    baseUrl: doc.baseUrl,
    type: doc.type,
    countries: doc.countries ?? [],
    categories: doc.categories ?? [],
    remoteFriendly: Boolean(doc.remoteFriendly),
    status: doc.status,
    config: (doc.config ?? {}) as JobSourceDto['config'],
    requiresUserToken: Boolean(doc.requiresUserToken),
    health: {
      lastSuccessAt: doc.health?.lastSuccessAt ?? null,
      lastErrorAt: doc.health?.lastErrorAt ?? null,
      failureCount: doc.health?.failureCount ?? 0,
      avgLatencyMs: doc.health?.avgLatencyMs ?? null,
    },
    addedBy: doc.addedBy ?? 'system',
    ownerId: doc.ownerId ?? null,
    createdAt: (doc as unknown as { createdAt?: Date }).createdAt ?? null,
  };
}

function toDoc(seed: SeedSource): Record<string, unknown> {
  return {
    id: seed.id,
    name: seed.name,
    description: seed.description ?? '',
    baseUrl: seed.baseUrl,
    type: seed.type,
    countries: seed.countries ?? [],
    categories: seed.categories ?? [],
    remoteFriendly: seed.remoteFriendly ?? true,
    status: seed.status,
    config: seed.config ?? {},
    requiresUserToken: Boolean(seed.requiresUserToken),
    health: emptyHealth(),
    addedBy: seed.addedBy ?? 'system',
    ownerId: null,
  };
}
