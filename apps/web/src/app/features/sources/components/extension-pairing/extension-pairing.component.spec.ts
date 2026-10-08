import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ExtensionPairingComponent } from './extension-pairing.component';
import { ExtensionService } from '../../data/extension.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import type { ExtensionDevice } from '@shared';

const device = (id: string, revoked = false): ExtensionDevice => ({
  id,
  label: 'Chrome',
  lastUsedAt: '2026-10-01T12:00:00.000Z',
  createdAt: '2026-09-01T12:00:00.000Z',
  revoked,
});

describe('ExtensionPairingComponent', () => {
  const mockI18n = {
    t: jasmine
      .createSpy('t')
      .and.returnValue(new Proxy({}, { get: (_t, key: string) => String(key) })),
  };

  const mockExtension = {
    createPairingChallenge: jasmine
      .createSpy('createPairingChallenge')
      .and.returnValue(of({ code: 'K7M2QX9P', expiresAt: '2026-10-08T10:00:00.000Z' })),
    listDevices: jasmine
      .createSpy('listDevices')
      .and.returnValue(of({ devices: [device('dev-1'), device('dev-2', true)] })),
    revokeDevice: jasmine
      .createSpy('revokeDevice')
      .and.returnValue(of({ devices: [device('dev-1', true), device('dev-2', true)] })),
  };

  beforeEach(async () => {
    mockExtension.createPairingChallenge.calls.reset();
    mockExtension.listDevices.calls.reset();
    mockExtension.revokeDevice.calls.reset();

    await TestBed.configureTestingModule({
      imports: [ExtensionPairingComponent],
      providers: [
        { provide: I18nService, useValue: mockI18n },
        { provide: ExtensionService, useValue: mockExtension },
      ],
    }).compileComponents();
  });

  const create = () => {
    const fixture = TestBed.createComponent(ExtensionPairingComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('keeps the body collapsed and skips device loading until opened', () => {
    const fixture = create();
    expect(fixture.nativeElement.querySelector('.pairing__body')).toBeNull();
    expect(mockExtension.listDevices).not.toHaveBeenCalled();

    fixture.componentInstance.toggle();
    fixture.detectChanges();
    expect(mockExtension.listDevices).toHaveBeenCalledTimes(1);
  });

  it('loads devices only once across toggles', () => {
    const fixture = create();
    fixture.componentInstance.toggle();
    fixture.componentInstance.toggle();
    fixture.componentInstance.toggle();
    expect(mockExtension.listDevices).toHaveBeenCalledTimes(1);
  });

  it('generates a pairing code and renders it', () => {
    const fixture = create();
    fixture.componentInstance.toggle();
    fixture.componentInstance.generate();
    fixture.detectChanges();

    expect(mockExtension.createPairingChallenge).toHaveBeenCalledTimes(1);
    const code: HTMLElement = fixture.nativeElement.querySelector('.pairing__code-value');
    expect(code.textContent?.trim()).toBe('K7M2QX9P');
    const expiry: HTMLElement = fixture.nativeElement.querySelector('.pairing__code-expiry');
    expect(expiry.textContent).toContain('sources.extension.expiresAt');
  });

  it('reports a friendly error when code generation fails', () => {
    mockExtension.createPairingChallenge.and.returnValue(throwError(() => new Error('boom')));
    const fixture = create();
    fixture.componentInstance.toggle();
    fixture.componentInstance.generate();

    expect(fixture.componentInstance.error()).toBe('sources.extension.generateFailed');

    // restore the happy stub for later suites
    mockExtension.createPairingChallenge.and.returnValue(
      of({ code: 'K7M2QX9P', expiresAt: '2026-10-08T10:00:00.000Z' }),
    );
  });

  it('lists active devices only and revokes them', () => {
    const fixture = create();
    fixture.componentInstance.toggle();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.pairing__device');
    expect(rows.length).toBe(1);

    fixture.componentInstance.revoke(device('dev-1'));
    expect(mockExtension.revokeDevice).toHaveBeenCalledWith('dev-1');
    expect(fixture.componentInstance.devices().length).toBe(2);
    expect(fixture.componentInstance.activeDevices().length).toBe(0);
  });
});
