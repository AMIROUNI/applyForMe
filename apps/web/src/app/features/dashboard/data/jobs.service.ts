import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type { JobSearchRequest, JobSearchResponse } from '@shared';
import type { ScraperRun, ScraperRunStart } from '@shared';

const API = '/api/v1';

/**
 * Talks to the NestJS API: job search runs against the jobs the scraper has
 * stored for the signed-in user; scraper runs are started and polled here.
 */
@Injectable({ providedIn: 'root' })
export class JobsService {
  private http = inject(HttpClient);

  search(request: JobSearchRequest): Observable<JobSearchResponse> {
    return this.http.post<JobSearchResponse>(`${API}/jobs/search`, request);
  }

  startScraperRun(params: ScraperRunStart): Observable<ScraperRun> {
    return this.http.post<ScraperRun>(`${API}/scraper/runs`, params);
  }

  getScraperRun(id: string): Observable<ScraperRun> {
    return this.http.get<ScraperRun>(`${API}/scraper/runs/${id}`);
  }
}
