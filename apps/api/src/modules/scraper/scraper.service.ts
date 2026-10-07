import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { ScraperRun, ScraperRunStart } from '@agency-apply/shared';
import { delay } from './http';
import { scoreJob } from './normalize';
import { resolveAdapter, type AdapterContext, type RegistrySource } from './adapters';
import { SourcesService } from '../sources/sources.service';
import { ProviderKeysService } from '../provider-keys/provider-keys.service';
import type { NormalizedJob, ScrapeParams } from './scraper.types';
import type { JobDocument } from '../jobs/job.schema';
import type { ScrapeRunDocument } from './run.schema';

const INTER_SOURCE_DELAY_MS = 800;

const sha1 = (value: string): string => createHash('sha1').update(value).digest('hex');

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    @InjectModel('ScrapeRun') private readonly runModel: Model<ScrapeRunDocument>,
    @InjectModel('Job') private readonly jobModel: Model<JobDocument>,
    private readonly sources: SourcesService,
    private readonly providerKeys: ProviderKeysService
  ) {}

  async startRun(userId: string, dto: ScraperRunStart): Promise<ScraperRun> {
    const active = await this.runModel
      .findOne({ userId, status: { $in: ['queued', 'running'] } })
      .exec();
    if (active) {
      throw new ConflictException({
        statusCode: 409,
        code: 'RUN_IN_PROGRESS',
        message: 'A scraper run is already in progress',
      });
    }

    const apifyToken = await this.providerKeys.getDecrypted(userId, 'apify');
    const ctx: AdapterContext = { apifyToken };
    const { usable, rejected } = await this.sources.resolve(dto.sources, ctx);

    if (!usable.length) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'UNSUPPORTED_SOURCES',
        message: 'None of the requested sources are supported',
        details: rejected,
      });
    }

    const run = await this.runModel.create({
      userId,
      status: 'queued',
      sources: usable.map(source => source.id),
      keywords: dto.keywords.map(k => k.trim()).filter(Boolean),
      countries: dto.countries,
      remoteOnly: dto.remoteOnly,
      progress: { total: usable.length, done: 0, found: 0 },
      errors: [],
      startedAt: null,
      finishedAt: null,
    });

    void this.execute(String(run._id), usable, ctx).catch(error => {
      this.logger.error(`Scraper run ${run._id} crashed`, error?.stack ?? error);
    });

    return this.toDto(run);
  }

  async getRun(userId: string, id: string): Promise<ScraperRun> {
    const run = await this.runModel.findById(id).exec();
    if (!run || run.userId !== userId) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'RUN_NOT_FOUND',
        message: 'Scraper run not found',
      });
    }
    return this.toDto(run);
  }

  private async execute(
    runId: string,
    resolved: RegistrySource[],
    ctx: AdapterContext
  ): Promise<void> {
    const run = await this.runModel.findById(runId).exec();
    if (!run) return;

    run.status = 'running';
    run.startedAt = new Date();
    await run.save();

    const params: ScrapeParams = {
      keywords: run.keywords,
      countries: run.countries,
      remoteOnly: run.remoteOnly,
    };

    let failed = 0;
    const seen = new Set<string>();

    for (const source of resolved) {
      const adapter = resolveAdapter(source, ctx);
      if (!adapter) {
        failed += 1;
        run.errors.push({ source: source.id, message: 'No adapter available for this source' });
      } else {
        const startedAt = Date.now();
        try {
          const jobs = await adapter.scrape(params);
          const fresh = jobs.filter(job => !seen.has(job.url));
          fresh.forEach(job => seen.add(job.url));
          const written = await this.persist(run.userId, fresh, run.keywords);
          run.progress.found += written;
          void this.sources.recordOutcome(source.id, true, Date.now() - startedAt);
        } catch (error) {
          failed += 1;
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Source ${source.id} failed: ${message}`);
          run.errors.push({ source: source.id, message });
          void this.sources.recordOutcome(source.id, false, Date.now() - startedAt);
        }
      }
      run.progress.done += 1;
      await run.save();
      await delay(INTER_SOURCE_DELAY_MS);
    }

    run.status = failed === resolved.length ? 'failed' : 'done';
    run.finishedAt = new Date();
    await run.save();
  }

  private async persist(
    userId: string,
    jobs: NormalizedJob[],
    keywords: string[]
  ): Promise<number> {
    if (!jobs.length) return 0;
    const now = new Date();
    const operations = jobs.map(job => {
      const { matchScore, matchReason } = scoreJob(
        job.title,
        `${job.description} ${job.company} ${job.skills.join(' ')}`,
        keywords
      );
      const doc = {
        userId,
        urlHash: sha1(job.url),
        sourceId: job.sourceId,
        sourceName: job.sourceName,
        title: job.title,
        company: job.company,
        location: job.location,
        country: job.country,
        description: job.description,
        url: job.url,
        postedAt: job.postedAt,
        scrapedAt: now,
        experienceLevel: job.experienceLevel,
        remoteType: job.remoteType,
        jobType: job.jobType,
        salary: job.salary,
        skills: job.skills,
        applyMethod: job.applyMethod,
        matchScore,
        matchReason,
      };
      return {
        updateOne: {
          filter: { userId, urlHash: doc.urlHash },
          update: { $set: doc, $setOnInsert: { status: 'new' } },
          upsert: true,
        },
      };
    });

    await this.jobModel.bulkWrite(operations, { ordered: false });
    return jobs.length;
  }

  private toDto(run: ScrapeRunDocument): ScraperRun {
    return {
      id: String(run._id),
      status: run.status,
      sources: run.sources,
      keywords: run.keywords,
      countries: run.countries,
      remoteOnly: run.remoteOnly,
      progress: run.progress,
      errors: run.errors ?? [],
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
    };
  }
}
