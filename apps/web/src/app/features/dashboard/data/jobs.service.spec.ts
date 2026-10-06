import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { JobsService } from './jobs.service';
import { emptyJobFilters } from '@shared';

const request = {
  query: '',
  filters: emptyJobFilters(),
  sort: 'matchScore' as const,
  page: 1,
  limit: 20,
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

  it('returns mock data when the endpoint is not implemented (404)', (done) => {
    service.search(request).subscribe((res) => {
      expect(res.data.length).toBeGreaterThan(0);
      expect(res.meta.total).toBe(res.data.length);
      done();
    });

    const req = httpMock.expectOne('/api/v1/jobs/search');
    expect(req.request.method).toBe('POST');
    req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
  });

  it('passes through a valid API response', (done) => {
    const apiResponse = {
      data: [],
      meta: { page: 1, limit: 20, total: 0 },
    };

    service.search(request).subscribe((res) => {
      expect(res.data).toEqual([]);
      expect(res.meta.total).toBe(0);
      done();
    });

    const req = httpMock.expectOne('/api/v1/jobs/search');
    req.flush(apiResponse);
  });

  it('filters mock data by query', (done) => {
    service.search({ ...request, query: 'kubernetes' }).subscribe((res) => {
      expect(res.data.every((j) => j.title.includes('Kubernetes'))).toBeTrue();
      expect(res.data.length).toBe(1);
      done();
    });

    const req = httpMock.expectOne('/api/v1/jobs/search');
    req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
  });

  it('propagates non-404 errors', (done) => {
    service.search(request).subscribe({
      next: () => fail('should not succeed'),
      error: (err) => {
        expect(err.status).toBe(500);
        done();
      },
    });

    const req = httpMock.expectOne('/api/v1/jobs/search');
    req.flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
  });
});
