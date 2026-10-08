import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ExtensionService } from './extension.service';

describe('ExtensionService', () => {
  let service: ExtensionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ExtensionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('creates a pairing challenge', () => {
    let code = '';
    service.createPairingChallenge().subscribe((challenge) => (code = challenge.code));

    const req = httpMock.expectOne('/api/v1/extension/pairing');
    expect(req.request.method).toBe('POST');
    req.flush({ code: 'K7M2QX9P', expiresAt: '2026-10-08T10:00:00.000Z' });
    expect(code).toBe('K7M2QX9P');
  });

  it('lists paired devices', () => {
    let count = -1;
    service.listDevices().subscribe((list) => (count = list.devices.length));

    const req = httpMock.expectOne('/api/v1/extension/devices');
    expect(req.request.method).toBe('GET');
    req.flush({
      devices: [
        { id: 'dev-1', label: 'Chrome', lastUsedAt: null, createdAt: null, revoked: false },
      ],
    });
    expect(count).toBe(1);
  });

  it('revokes a device by id', () => {
    let revoked = false;
    service
      .revokeDevice('dev-1')
      .subscribe((list) => (revoked = list.devices.every((d) => d.revoked)));

    const req = httpMock.expectOne('/api/v1/extension/devices/dev-1');
    expect(req.request.method).toBe('DELETE');
    req.flush({
      devices: [{ id: 'dev-1', label: 'Chrome', lastUsedAt: null, createdAt: null, revoked: true }],
    });
    expect(revoked).toBe(true);
  });
});
