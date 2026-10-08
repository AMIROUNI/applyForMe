import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type { ExtensionDeviceList, ExtensionPairingChallenge } from '@shared';

const API = '/api/v1';

/** Pairing + device management for the browser extension (`/api/v1/extension`). */
@Injectable({ providedIn: 'root' })
export class ExtensionService {
  private http = inject(HttpClient);

  /** Mints a short-lived, single-use code the extension exchanges for a token. */
  createPairingChallenge(): Observable<ExtensionPairingChallenge> {
    return this.http.post<ExtensionPairingChallenge>(`${API}/extension/pairing`, {});
  }

  listDevices(): Observable<ExtensionDeviceList> {
    return this.http.get<ExtensionDeviceList>(`${API}/extension/devices`);
  }

  revokeDevice(id: string): Observable<ExtensionDeviceList> {
    return this.http.delete<ExtensionDeviceList>(`${API}/extension/devices/${id}`);
  }
}
