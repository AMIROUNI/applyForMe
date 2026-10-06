import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { catchError, map, of, throwError } from 'rxjs';
import type { JobSearchRequest, JobSearchResponse } from '@shared';
import { jobSearchResponseSchema } from '@shared';
import { MOCK_JOBS } from './mock-jobs';

const API = '/api/v1';

/**
 * Reads the jobs search endpoint. Until the backend exposes
 * `POST /api/v1/jobs/search` (plan step: job cards API), a 404 falls back to
 * local mock data so the dashboard UI can be built and tested independently.
 */
@Injectable({ providedIn: 'root' })
export class JobsService {
  private http = inject(HttpClient);

  search(request: JobSearchRequest): Observable<JobSearchResponse> {
    return this.http.post<JobSearchResponse>(`${API}/jobs/search`, request).pipe(
      map((res) => jobSearchResponseSchema.parse(res)),
      catchError((err) =>
        this.isMissingEndpoint(err) ? of(this.mockResponse(request)) : throwError(() => err),
      ),
    );
  }

  private isMissingEndpoint(err: unknown): boolean {
    return err instanceof HttpErrorResponse && (err.status === 404 || err.status === 501);
  }

  private mockResponse(request: JobSearchRequest): JobSearchResponse {
    const query = request.query.trim().toLowerCase();
    const { filters } = request;

    const filtered = MOCK_JOBS.filter((job) => {
      if (
        query &&
        !`${job.title} ${job.company} ${job.description} ${job.skills.join(' ')}`
          .toLowerCase()
          .includes(query)
      ) {
        return false;
      }
      if (filters.countries.length && !filters.countries.includes(job.country)) return false;
      if (filters.statuses.length && !filters.statuses.includes(job.status)) return false;
      if (
        filters.experienceLevels.length &&
        !filters.experienceLevels.includes(job.experienceLevel)
      ) {
        return false;
      }
      if (filters.remoteTypes.length && !filters.remoteTypes.includes(job.remoteType)) return false;
      if (filters.jobTypes.length && !filters.jobTypes.includes(job.jobType)) return false;
      if (filters.minScore !== null && job.matchScore < filters.minScore) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) =>
      request.sort === 'company'
        ? a.company.localeCompare(b.company)
        : request.sort === 'postedAt'
          ? +new Date(b.postedAt) - +new Date(a.postedAt)
          : b.matchScore - a.matchScore,
    );

    const start = (request.page - 1) * request.limit;
    const data = sorted.slice(start, start + request.limit);

    return { data, meta: { page: request.page, limit: request.limit, total: sorted.length } };
  }
}
