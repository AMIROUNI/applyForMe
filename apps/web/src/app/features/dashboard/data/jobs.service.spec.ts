import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { JobsService } from './jobs.service';
import { emptyJobFilters, emptyScraperRunStart } from '@shared';

const request = {
  query: '',
  filters: emptyJobFilters(),
  sort: 'matchScore' as const,
  page: 1,
  limit: 20,
};

const searchResponse = {
  data: [
    {
      id: 'job-1',
      urlHash: 'hash',
      sourceId: 'remotive',
      sourceName: 'Remotive',
      title: 'React Developer',
      company: 'Acme',
      location: 'Worldwide',
      country: '',
      description: 'Build apps',
      url: 'https://example.com/j/1',
      postedAt: '2026-10-01T00:00:00.000Z',
      scrapedAt: '2026-10-02T00:00:00.000Z',
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
  ],
  meta: { page: 1, limit: 20, total: 1 },
};

describe('JobsService', () => {
  let service: JobsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(JobsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('posts the search request to the API', () => {
    service.search(request).subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.meta.total).toBe(1);
    });

    const req = httpMock.expectOne('/api/v1/jobs/search');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush(searchResponse);
  });

  it('starts a scraper run', () => {
    const run = {
      id: 'run-1',
      status: 'queued',
      sources: ['remotive'],
      keywords: ['react'],
      countries: [],
      remoteOnly: false,
      progress: { total: 1, done: 0, found: 0 },
      errors: [],
      startedAt: null,
      finishedAt: null,
    };
    const params = { ...emptyScraperRunStart(), sources: ['remotive'], keywords: ['react'] };

    service.startScraperRun(params).subscribe((result) => {
      expect(result.id).toBe('run-1');
      expect(result.status).toBe('queued');
    });

    const req = httpMock.expectOne('/api/v1/scraper/runs');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(params);
    req.flush(run);
  });

  it('polls a scraper run by id', () => {
    const run = {
      id: 'run-1',
      status: 'running',
      sources: [],
      keywords: [],
      countries: [],
      remoteOnly: false,
      progress: { total: 4, done: 2, found: 7 },
      errors: [],
      startedAt: null,
      finishedAt: null,
    };

    service.getScraperRun('run-1').subscribe((result) => {
      expect(result.progress.done).toBe(2);
    });

    const req = httpMock.expectOne('/api/v1/scraper/runs/run-1');
    expect(req.request.method).toBe('GET');
    req.flush(run);
  });

  it('patches an extension task action on a run', () => {
    const run = {
      id: 'run-1',
      status: 'running',
      sources: [],
      keywords: [],
      countries: [],
      remoteOnly: false,
      progress: { total: 1, done: 0, found: 0 },
      errors: [],
      extensionTasks: [],
      startedAt: null,
      finishedAt: null,
    };

    service.updateExtensionTask('run-1', 'task-1', 'retry').subscribe((result) => {
      expect(result.id).toBe('run-1');
    });

    const req = httpMock.expectOne('/api/v1/scraper/runs/run-1/extension-tasks/task-1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ action: 'retry' });
    req.flush(run);
  });

  it('propagates API errors to the subscriber', () => {
    let status = 0;
    service.search(request).subscribe({ error: (err) => (status = err.status) });

    const req = httpMock.expectOne('/api/v1/jobs/search');
    req.flush(
      { statusCode: 401, code: 'UNAUTHORIZED', message: 'No token' },
      { status: 401, statusText: 'Unauthorized' },
    );
    expect(status).toBe(401);
  });
});
