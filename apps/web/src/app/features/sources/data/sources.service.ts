import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type { CreateSource, JobSource, SourceListQuery, SourceValidateResult } from '@shared';

const API = '/api/v1';

/** CRUD + validation for the job source registry (`/api/v1/sources`). */
@Injectable({ providedIn: 'root' })
export class SourcesService {
  private http = inject(HttpClient);

  list(query: SourceListQuery = {}): Observable<JobSource[]> {
    let params = new HttpParams();
    if (query.country) params = params.set('country', query.country);
    if (query.type) params = params.set('type', query.type);
    if (query.status) params = params.set('status', query.status);
    return this.http.get<JobSource[]>(`${API}/sources`, { params });
  }

  create(payload: CreateSource): Observable<JobSource> {
    return this.http.post<JobSource>(`${API}/sources`, payload);
  }

  validate(id: string): Observable<SourceValidateResult> {
    return this.http.post<SourceValidateResult>(`${API}/sources/${id}/validate`, {});
  }
}
