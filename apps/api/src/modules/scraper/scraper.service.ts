import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type {
  ExtensionTaskAction,
  ExtensionTaskAssignment,
  ExtensionTaskUpdate,
  IngestJobItem,
  IngestJobsRequest,
  IngestJobsResponse,
  ScraperRun,
  ScraperRunStart,
} from '@agency-apply/shared';
import { delay } from './http';
import { scoreJob } from './normalize';
import { resolveAdapter, type RegistrySource } from './adapters';
import { SourcesService } from '../sources/sources.service';
import {
  applyTaskUpdate,
  canTransitionExtensionTask,
  isTerminalTask,
  taskSnapshot,
  type TaskLike,
} from './extension-tasks';
import { buildExtensionSearchUrl } from './extension-urls';
import type { NormalizedJob, ScrapeParams } from './scraper.types';
import type { JobDocument } from '../jobs/job.schema';
import type { ExtensionTaskRecord, ScrapeRunDocument } from './run.schema';

const INTER_SOURCE_DELAY_MS = 800;
export const EXTENSION_TASK_STALE_MS = 10 * 60 * 1000;
const STALE_SWEEP_INTERVAL_MS = 60 * 1000;

const sha1 = (value: string): string => createHash('sha1').update(value).digest('hex');

const taskList = (run: ScrapeRunDocument): ExtensionTaskRecord[] => run.extensionTasks ?? [];

const USER_TASK_ACTIONS: Record<ExtensionTaskAction, ExtensionTaskRecord['status']> = {
  cancel: 'cancelled',
  skip: 'skipped',
  retry: 'running',
};

@Injectable()
export class ScraperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScraperService.name);
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectModel('ScrapeRun') private readonly runModel: Model<ScrapeRunDocument>,
    @InjectModel('Job') private readonly jobModel: Model<JobDocument>,
    private readonly sources: SourcesService
  ) {}

  onModuleInit(): void {
    this.sweepTimer = setInterval(() => void this.sweepStaleTasks(), STALE_SWEEP_INTERVAL_MS);
    if (typeof this.sweepTimer.unref === 'function') this.sweepTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.sweepTimer = null;
  }

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

    const { usable, extension, rejected } = await this.sources.resolve(dto.sources);

    if (!usable.length && !extension.length) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'UNSUPPORTED_SOURCES',
        message: 'None of the requested sources are supported',
        details: rejected,
      });
    }

    const keywords = dto.keywords.map(k => k.trim()).filter(Boolean);
    const tasks = extension.map(source =>
      this.buildTask(source.id, source.baseUrl, keywords, dto.countries, dto.remoteOnly)
    );

    const run = await this.runModel.create({
      userId,
      status: 'queued',
      sources: [...usable.map(source => source.id), ...extension.map(source => source.id)],
      keywords,
      countries: dto.countries,
      remoteOnly: dto.remoteOnly,
      progress: { total: usable.length + tasks.length, done: 0, found: 0 },
      errors: [],
      extensionTasks: tasks,
      startedAt: null,
      finishedAt: null,
    });

    void this.execute(String(run._id), usable).catch(error => {
      this.logger.error(`Scraper run ${run._id} crashed`, error?.stack ?? error);
    });

    return this.toDto(run);
  }

  async getRun(userId: string, id: string): Promise<ScraperRun> {
    const run = await this.findOwnedRun(userId, id);
    return this.toDto(run);
  }

  async updateTaskByUser(
    userId: string,
    runId: string,
    taskId: string,
    action: ExtensionTaskAction
  ): Promise<ScraperRun> {
    const run = await this.findOwnedRun(userId, runId);
    const index = taskList(run).findIndex(task => task.id === taskId);
    if (index < 0) throw this.taskNotFound(taskId);

    const current = run.extensionTasks[index] as TaskLike;
    const status = USER_TASK_ACTIONS[action];
    if (!canTransitionExtensionTask(current.status, status)) {
      throw new ConflictException({
        statusCode: 409,
        code: 'TASK_STATE_INVALID',
        message: `A ${current.status} task cannot be ${status}`,
      });
    }
    this.applyToRun(run, index, { status });
    await run.save();
    await this.finishIfComplete(run);
    return this.toDto(run);
  }

  async updateTaskByExtension(
    userId: string,
    taskId: string,
    update: ExtensionTaskUpdate
  ): Promise<ScraperRun> {
    const run = await this.findRunByTaskId(taskId);
    if (!run || run.userId !== userId) throw this.taskNotFound(taskId);

    const index = taskList(run).findIndex(task => task.id === taskId);
    this.applyToRun(run, index, update);
    await run.save();
    await this.finishIfComplete(run);
    return this.toDto(run);
  }

  async listExtensionTasks(userId: string): Promise<ExtensionTaskAssignment[]> {
    const runs = await this.runModel
      .find({ userId, status: { $in: ['queued', 'running'] } })
      .exec();
    const tasks: ExtensionTaskAssignment[] = [];
    for (const run of runs) {
      for (const task of run.extensionTasks ?? []) {
        if (task.status !== 'pending' && task.status !== 'running') continue;
        tasks.push({
          runId: String(run._id),
          taskId: task.id,
          source: task.source,
          status: task.status,
          searchUrl: task.searchUrl,
          keywords: run.keywords,
          countries: run.countries,
          remoteOnly: run.remoteOnly,
        });
      }
    }
    return tasks;
  }

  async ingestJobs(userId: string, dto: IngestJobsRequest): Promise<IngestJobsResponse> {
    const run = await this.findRunByTaskId(dto.taskId);
    if (!run || run.userId !== userId) throw this.taskNotFound(dto.taskId);
    if (dto.runId && dto.runId !== String(run._id)) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'RUN_TASK_MISMATCH',
        message: 'That task does not belong to the given run',
      });
    }

    const index = taskList(run).findIndex(task => task.id === dto.taskId);
    const current = run.extensionTasks[index] as TaskLike;
    if (current.status !== 'running' && current.status !== 'pending') {
      throw new ConflictException({
        statusCode: 409,
        code: 'TASK_NOT_RUNNING',
        message: `A ${current.status} task cannot receive items`,
      });
    }

    if (current.status === 'pending') this.applyToRun(run, index, { status: 'running' });

    const sourceName = sourceDisplayName(current.source);
    const jobs = dto.items.map(item => toNormalizedJob(item, current.source, sourceName));
    const ingested = await this.persist(userId, jobs, run.keywords);

    run.progress.found += dto.items.length;
    const active = taskSnapshot(run.extensionTasks[index] as TaskLike);
    run.extensionTasks[index] = {
      ...active,
      itemsFound: active.itemsFound + dto.items.length,
    } as ExtensionTaskRecord;
    await run.save();

    return { ingested, found: run.progress.found, taskStatus: active.status };
  }

  async sweepStaleTasks(): Promise<void> {
    const runs = await this.runModel.find({ status: { $in: ['queued', 'running'] } }).exec();
    for (const run of runs) {
      const now = Date.now();
      const base = run.startedAt ? run.startedAt.getTime() : now;
      let dirty = false;

      (run.extensionTasks ?? []).forEach((task, index) => {
        if (task.status === 'pending' && now - base > EXTENSION_TASK_STALE_MS) {
          const applied = applyTaskUpdate(task as TaskLike, {
            status: 'skipped',
            message: 'No browser activity within 10 minutes',
          });
          if (applied.ok) {
            run.extensionTasks[index] = applied.task as ExtensionTaskRecord;
            run.progress.done += 1;
            dirty = true;
          }
        } else if (
          task.status === 'running' &&
          task.startedAt &&
          now - task.startedAt.getTime() > EXTENSION_TASK_STALE_MS
        ) {
          const applied = applyTaskUpdate(task as TaskLike, {
            status: 'failed',
            message: 'No browser activity for 10 minutes',
          });
          if (applied.ok) {
            run.extensionTasks[index] = applied.task as ExtensionTaskRecord;
            run.progress.done += 1;
            dirty = true;
          }
        }
      });

      if (dirty) await run.save();
      await this.finishIfComplete(run);
    }
  }

  private async execute(runId: string, resolved: RegistrySource[]): Promise<void> {
    const run = await this.runModel.findById(runId).exec();
    if (!run) return;

    run.status = 'running';
    run.startedAt = run.startedAt ?? new Date();
    await run.save();

    const params: ScrapeParams = {
      keywords: run.keywords,
      countries: run.countries,
      remoteOnly: run.remoteOnly,
    };

    const seen = new Set<string>();

    for (const source of resolved) {
      const adapter = resolveAdapter(source);
      if (!adapter) {
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

    await this.finishIfComplete(run);
  }

  private applyToRun(run: ScrapeRunDocument, index: number, update: ExtensionTaskUpdate): void {
    const current = run.extensionTasks[index] as TaskLike;
    const result = applyTaskUpdate(current, update);
    if (!result.ok) {
      throw new ConflictException({
        statusCode: 409,
        code: 'TASK_STATE_INVALID',
        message: result.reason ?? 'Illegal task update',
      });
    }

    const wasTerminal = isTerminalTask(current.status);
    run.extensionTasks[index] = result.task as ExtensionTaskRecord;

    if (wasTerminal && result.task.status === 'running') {
      run.progress.done = Math.max(0, run.progress.done - 1);
      run.status = 'running';
      run.finishedAt = null;
    } else if (result.becameTerminal) {
      run.progress.done += 1;
    }
  }

  private async finishIfComplete(run: ScrapeRunDocument): Promise<void> {
    if (run.status === 'done' || run.status === 'failed') return;
    if (run.progress.done < run.progress.total) return;

    const failedUnits =
      (run.errors?.length ?? 0) +
      (run.extensionTasks ?? []).filter(
        task => task.status === 'failed' || task.status === 'blocked'
      ).length;

    run.status = run.progress.total > 0 && failedUnits >= run.progress.total ? 'failed' : 'done';
    run.finishedAt = new Date();
    await run.save();
  }

  private buildTask(
    sourceId: string,
    baseUrl: string,
    keywords: string[],
    countries: string[],
    remoteOnly: boolean
  ): ExtensionTaskRecord {
    let searchUrl = baseUrl;
    try {
      searchUrl = buildExtensionSearchUrl(sourceId, { keywords, countries, remoteOnly, baseUrl });
    } catch (error) {
      this.logger.warn(`No search URL for ${sourceId}: ${errorMessage(error)}`);
    }
    return {
      id: `${sourceId}-${randomUUID().slice(0, 8)}`,
      source: sourceId,
      status: 'pending',
      searchUrl,
      pagesCaptured: 0,
      itemsFound: 0,
      message: '',
      startedAt: null,
      finishedAt: null,
    };
  }

  private async findOwnedRun(userId: string, id: string): Promise<ScrapeRunDocument> {
    const run = await this.runModel.findById(id).exec();
    if (!run || run.userId !== userId) throw this.runNotFound();
    return run;
  }

  private async findRunByTaskId(taskId: string): Promise<ScrapeRunDocument | null> {
    try {
      return await this.runModel.findOne({ 'extensionTasks.id': taskId }).exec();
    } catch {
      return null;
    }
  }

  private runNotFound(): NotFoundException {
    return new NotFoundException({
      statusCode: 404,
      code: 'RUN_NOT_FOUND',
      message: 'Scraper run not found',
    });
  }

  private taskNotFound(taskId: string): NotFoundException {
    return new NotFoundException({
      statusCode: 404,
      code: 'EXTENSION_TASK_NOT_FOUND',
      message: `Extension task "${taskId}" not found`,
    });
  }

  async persist(userId: string, jobs: NormalizedJob[], keywords: string[]): Promise<number> {
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
      extensionTasks: (run.extensionTasks ?? []).map(task => ({
        id: task.id,
        source: task.source,
        status: task.status,
        searchUrl: task.searchUrl,
        pagesCaptured: task.pagesCaptured,
        itemsFound: task.itemsFound,
        message: task.message,
        startedAt: task.startedAt,
        finishedAt: task.finishedAt,
      })),
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
    };
  }
}

const sourceDisplayName = (sourceId: string): string => {
  const names: Record<string, string> = {
    linkedin_jobs: 'LinkedIn Jobs',
    linkedin_posts: 'LinkedIn hiring posts',
    indeed: 'Indeed',
  };
  return names[sourceId] ?? sourceId;
};

const toNormalizedJob = (
  item: IngestJobItem,
  sourceId: string,
  sourceName: string
): NormalizedJob => ({
  sourceId,
  sourceName,
  title: item.title,
  company: item.company ?? '',
  location: item.location ?? '',
  country: item.country ?? '',
  description: item.description ?? '',
  url: item.url,
  postedAt: item.postedAt ? new Date(item.postedAt) : new Date(),
  remoteType: item.remoteType && item.remoteType !== 'all' ? item.remoteType : 'remote',
  jobType: item.jobType ?? 'full-time',
  experienceLevel: item.experienceLevel ?? 'mid',
  skills: item.skills ?? [],
  salary: item.salary ?? null,
  applyMethod: 'external',
});

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
