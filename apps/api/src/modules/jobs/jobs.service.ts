import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { DatePosted, Job, JobSearchRequest, JobSearchResponse } from '@agency-apply/shared';
import type { JobDocument } from './job.schema';

const DATE_WINDOW_DAYS: Record<DatePosted, number> = {
  'last-24h': 1,
  'last-week': 7,
  'last-month': 30,
  'last-3-months': 90,
  all: 0,
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class JobsService {
  constructor(@InjectModel('Job') private readonly jobModel: Model<JobDocument>) {}

  async search(userId: string, request: JobSearchRequest): Promise<JobSearchResponse> {
    const filter = this.buildFilter(userId, request);
    const sort: Record<string, 1 | -1> =
      request.sort === 'company'
        ? { company: 1 }
        : request.sort === 'postedAt'
          ? { postedAt: -1 }
          : { matchScore: -1 };

    const total = await this.jobModel.countDocuments(filter).exec();
    const skip = (request.page - 1) * request.limit;
    const docs = await this.jobModel
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(request.limit)
      .lean()
      .exec();

    return {
      data: docs.map(doc => this.toDto(doc as unknown as JobDocument)),
      meta: { page: request.page, limit: request.limit, total },
    };
  }

  private buildFilter(userId: string, request: JobSearchRequest): Record<string, unknown> {
    const { filters, query } = request;
    const and: Record<string, unknown>[] = [{ userId }];

    const trimmed = query.trim();
    if (trimmed) {
      const pattern = new RegExp(escapeRegex(trimmed), 'i');
      and.push({
        $or: [
          { title: pattern },
          { company: pattern },
          { description: pattern },
          { skills: pattern },
        ],
      });
    }

    if (filters.countries.length) and.push({ country: { $in: filters.countries } });
    if (filters.sources.length) and.push({ sourceId: { $in: filters.sources } });
    if (filters.statuses.length) and.push({ status: { $in: filters.statuses } });
    if (filters.experienceLevels.length)
      and.push({ experienceLevel: { $in: filters.experienceLevels } });
    if (filters.remoteTypes.length) and.push({ remoteType: { $in: filters.remoteTypes } });
    if (filters.jobTypes.length) and.push({ jobType: { $in: filters.jobTypes } });
    if (filters.minScore !== null) and.push({ matchScore: { $gte: filters.minScore } });

    const days = DATE_WINDOW_DAYS[filters.datePosted];
    if (days) {
      and.push({ postedAt: { $gte: new Date(Date.now() - days * 86_400_000) } });
    }

    return { $and: and };
  }

  private toDto(doc: JobDocument): Job {
    return {
      id: String(doc._id),
      urlHash: doc.urlHash,
      sourceId: doc.sourceId,
      sourceName: doc.sourceName,
      title: doc.title,
      company: doc.company,
      location: doc.location,
      country: doc.country,
      description: doc.description,
      url: doc.url,
      postedAt: doc.postedAt,
      scrapedAt: doc.scrapedAt,
      experienceLevel: doc.experienceLevel as Job['experienceLevel'],
      remoteType: doc.remoteType as Job['remoteType'],
      jobType: doc.jobType as Job['jobType'],
      salary: (doc.salary as Job['salary']) ?? null,
      skills: doc.skills ?? [],
      applyMethod: doc.applyMethod as Job['applyMethod'],
      matchScore: doc.matchScore,
      matchReason: doc.matchReason,
      status: doc.status as Job['status'],
    };
  }
}
