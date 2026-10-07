import { JobsService } from './jobs.service';
import type { JobFilters, JobSearchRequest } from '@agency-apply/shared';

const defaultFilters = (): JobFilters => ({
  countries: [],
  sources: [],
  statuses: [],
  experienceLevels: [],
  remoteTypes: [],
  jobTypes: [],
  datePosted: 'all',
  minScore: null,
});

const baseRequest = (
  overrides: { filters?: Partial<JobFilters>; query?: string; sort?: JobSearchRequest['sort'] } = {}
): JobSearchRequest => ({
  query: overrides.query ?? '',
  filters: { ...defaultFilters(), ...(overrides.filters ?? {}) },
  sort: overrides.sort ?? 'matchScore',
  page: 1,
  limit: 20,
});

describe('JobsService', () => {
  let findChain: Record<string, jest.Mock>;
  let jobModel: { countDocuments: jest.Mock; find: jest.Mock };
  let service: JobsService;
  let capturedFilter: unknown;

  beforeEach(() => {
    findChain = {
      sort: jest.fn(),
      skip: jest.fn(),
      limit: jest.fn(),
      lean: jest.fn(),
      exec: jest.fn().mockResolvedValue([
        {
          _id: 'abc123',
          urlHash: 'hash',
          sourceId: 'remotive',
          sourceName: 'Remotive',
          title: 'React Developer',
          company: 'Acme',
          location: 'Worldwide',
          country: '',
          description: 'Build apps',
          url: 'https://example.com/j/1',
          postedAt: new Date('2026-10-01'),
          scrapedAt: new Date('2026-10-02'),
          experienceLevel: 'mid',
          remoteType: 'remote',
          jobType: 'full-time',
          salary: null,
          skills: ['react'],
          applyMethod: 'external',
          matchScore: 85,
          matchReason: 'Matches keyword: react',
          status: 'new',
        },
      ]),
    };
    findChain.sort.mockReturnValue(findChain);
    findChain.skip.mockReturnValue(findChain);
    findChain.limit.mockReturnValue(findChain);
    findChain.lean.mockReturnValue(findChain);

    jobModel = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(1) }),
      find: jest.fn().mockImplementation((filter: unknown) => {
        capturedFilter = filter;
        return findChain;
      }),
    };
    service = new JobsService(jobModel as never);
  });

  it('returns mapped dto and meta', async () => {
    const result = await service.search('user-1', baseRequest());
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 1 });
    expect(result.data[0]).toMatchObject({
      id: 'abc123',
      title: 'React Developer',
      matchScore: 85,
      status: 'new',
    });
    expect(findChain.limit).toHaveBeenCalledWith(20);
  });

  it('scopes the query by userId', async () => {
    await service.search('user-1', baseRequest());
    expect(capturedFilter).toEqual({ $and: [{ userId: 'user-1' }] });
  });

  it('adds keyword, country and score filters', async () => {
    await service.search(
      'user-1',
      baseRequest({
        query: 'react',
        filters: { countries: ['tn'], minScore: 75 },
      })
    );
    const filter = capturedFilter as { $and: Array<Record<string, unknown>> };
    expect(filter.$and[0]).toEqual({ userId: 'user-1' });
    const keywordClause = filter.$and[1] as { $or: Array<Record<string, unknown>> };
    expect(keywordClause.$or).toHaveLength(4);
    expect(keywordClause.$or[0].title).toEqual(expect.any(RegExp));
    expect(filter.$and).toContainEqual({ country: { $in: ['tn'] } });
    expect(filter.$and).toContainEqual({ matchScore: { $gte: 75 } });
  });

  it('applies the date window', async () => {
    await service.search('user-1', baseRequest({ filters: { datePosted: 'last-week' } }));
    const filter = capturedFilter as { $and: Array<Record<string, unknown>> };
    const dateClause = filter.$and.find(clause => 'postedAt' in clause) as {
      postedAt: { $gte: Date };
    };
    expect(dateClause.postedAt.$gte).toBeInstanceOf(Date);
    expect(Date.now() - dateClause.postedAt.$gte.getTime()).toBeLessThanOrEqual(
      7 * 86_400_000 + 1000
    );
  });

  it('sorts by the requested key', async () => {
    await service.search('user-1', baseRequest({ sort: 'company' }));
    expect(findChain.sort).toHaveBeenCalledWith({ company: 1 });
    await service.search('user-1', baseRequest({ sort: 'postedAt' }));
    expect(findChain.sort).toHaveBeenCalledWith({ postedAt: -1 });
  });
});
