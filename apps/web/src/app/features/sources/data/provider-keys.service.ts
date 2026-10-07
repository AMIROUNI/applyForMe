import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type { ProviderKeyInfo, ProviderKeyRemoveResult } from '@shared';

const API = '/api/v1';

/** Connect / disconnect user-owned provider tokens (`/api/v1/provider-keys`). */
@Injectable({ providedIn: 'root' })
export class ProviderKeysService {
  private http = inject(HttpClient);

  list(): Observable<ProviderKeyInfo[]> {
    return this.http.get<ProviderKeyInfo[]>(`${API}/provider-keys`);
  }

  connect(provider: string, token: string): Observable<ProviderKeyInfo> {
    return this.http.put<ProviderKeyInfo>(`${API}/provider-keys/${provider}`, { token });
  }

  disconnect(provider: string): Observable<ProviderKeyRemoveResult> {
    return this.http.delete<ProviderKeyRemoveResult>(`${API}/provider-keys/${provider}`);
  }
}
