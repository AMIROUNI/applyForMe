import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ExtensionDevice, ExtensionPairingChallenge } from '@shared';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ExtensionService } from '../../data/extension.service';

@Component({
  selector: 'app-extension-pairing',
  standalone: true,
  imports: [CommonModule, ButtonComponent, SkeletonComponent],
  template: `
    <section class="pairing" [attr.aria-label]="t()['sources.extension.title']">
      <header class="pairing__head">
        <div class="pairing__head-text">
          <h2 class="pairing__title">{{ t()['sources.extension.title'] }}</h2>
          <p class="pairing__subtitle">{{ t()['sources.extension.subtitle'] }}</p>
        </div>
        <app-button variant="secondary" size="compact" (clicked)="toggle()">
          {{ open() ? t()['sources.extension.close'] : t()['sources.extension.connect'] }}
        </app-button>
      </header>

      @if (open()) {
        <div class="pairing__body">
          <ol class="pairing__steps">
            <li>{{ t()['sources.extension.step1'] }}</li>
            <li>{{ t()['sources.extension.step2'] }}</li>
            <li>{{ t()['sources.extension.step3'] }}</li>
          </ol>

          @if (code(); as value) {
            <div class="pairing__code">
              <span class="pairing__code-label">{{ t()['sources.extension.codeLabel'] }}</span>
              <span class="pairing__code-value">{{ value }}</span>
              <span class="pairing__code-expiry">{{ expiryLabel() }}</span>
            </div>
            <div class="pairing__code-actions">
              <app-button variant="primary" size="compact" (clicked)="copyCode()">
                {{ copied() ? t()['sources.extension.copied'] : t()['sources.extension.copy'] }}
              </app-button>
              <app-button
                variant="secondary"
                size="compact"
                [loading]="generating()"
                (clicked)="generate()"
              >
                {{ t()['sources.extension.newCode'] }}
              </app-button>
            </div>
          } @else {
            <app-button variant="primary" [loading]="generating()" (clicked)="generate()">
              {{ t()['sources.extension.generate'] }}
            </app-button>
          }

          @if (error(); as err) {
            <p class="pairing__error" role="alert">{{ errorLabel(err) }}</p>
          }

          <div class="pairing__devices">
            <div class="pairing__devices-head">
              <h3 class="pairing__devices-title">{{ t()['sources.extension.devices'] }}</h3>
              <button
                type="button"
                class="pairing__link"
                [disabled]="devicesLoading()"
                (click)="loadDevices()"
              >
                {{ t()['sources.extension.refresh'] }}
              </button>
            </div>

            @if (devicesLoading() && devices().length === 0) {
              <app-skeleton variant="text" width="60%" />
            } @else if (activeDevices().length === 0) {
              <p class="pairing__empty">{{ t()['sources.extension.devicesEmpty'] }}</p>
            } @else {
              <ul class="pairing__device-list">
                @for (device of activeDevices(); track device.id) {
                  <li class="pairing__device">
                    <div class="pairing__device-text">
                      <span class="pairing__device-label">{{ device.label }}</span>
                      <span class="pairing__device-meta">{{ lastUsedLabel(device) }}</span>
                    </div>
                    <app-button
                      variant="ghost"
                      size="compact"
                      [loading]="revokingId() === device.id"
                      (clicked)="revoke(device)"
                    >
                      {{ t()['sources.extension.revoke'] }}
                    </app-button>
                  </li>
                }
              </ul>
            }
          </div>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .pairing {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-3);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-card);
        padding: var(--spacing-4);
      }

      .pairing__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--spacing-3);
      }

      .pairing__head-text {
        min-width: 0;
      }

      .pairing__title {
        font-family: var(--font-heading);
        font-size: var(--text-base);
        font-weight: var(--font-weight-semibold);
        margin: 0;
      }

      .pairing__subtitle {
        margin: var(--spacing-1) 0 0;
        font-size: var(--text-xs);
        line-height: var(--leading-normal);
        color: var(--color-text-muted);
      }

      .pairing__body {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-3);
        padding-top: var(--spacing-3);
        border-top: 1px solid var(--color-border);
      }

      .pairing__steps {
        margin: 0;
        padding-left: var(--spacing-5);
        display: flex;
        flex-direction: column;
        gap: var(--spacing-1);
        font-size: var(--text-xs);
        line-height: var(--leading-normal);
        color: var(--color-text-muted);
      }

      .pairing__code {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-1);
        padding: var(--spacing-3);
        background: var(--color-surface-alt);
        border: 1px dashed var(--color-primary);
        border-radius: var(--radius-input);
        align-items: center;
        text-align: center;
      }

      .pairing__code-label {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .pairing__code-value {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xl);
        font-weight: var(--font-weight-bold);
        letter-spacing: 0.12em;
        color: var(--color-text);
        overflow-wrap: anywhere;
      }

      .pairing__code-expiry {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      .pairing__code-actions {
        display: flex;
        gap: var(--spacing-2);
        flex-wrap: wrap;
      }

      .pairing__error {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-danger);
      }

      .pairing__devices {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-2);
      }

      .pairing__devices-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacing-2);
      }

      .pairing__devices-title {
        font-family: var(--font-heading);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        margin: 0;
      }

      .pairing__link {
        padding: 0;
        border: none;
        background: transparent;
        font-family: var(--font-body);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-medium);
        color: var(--color-primary);
        cursor: pointer;
      }

      .pairing__link:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .pairing__empty {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      .pairing__device-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-2);
      }

      .pairing__device {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacing-2);
        padding: var(--spacing-2) var(--spacing-3);
        background: var(--color-surface-alt);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-input);
      }

      .pairing__device-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .pairing__device-label {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        overflow-wrap: anywhere;
      }

      .pairing__device-meta {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class ExtensionPairingComponent {
  private i18n = inject(I18nService);
  private extension = inject(ExtensionService);

  readonly open = signal(false);
  readonly code = signal<string | null>(null);
  readonly expiresAt = signal<string | Date | null>(null);
  readonly generating = signal(false);
  readonly copied = signal(false);
  readonly error = signal<string | null>(null);

  readonly devices = signal<ExtensionDevice[]>([]);
  readonly devicesLoading = signal(false);
  readonly revokingId = signal<string | null>(null);

  private devicesLoaded = false;

  t = computed(() => this.i18n.t());

  readonly activeDevices = computed(() => this.devices().filter((device) => !device.revoked));

  readonly expiryLabel = computed(() => {
    const expiresAt = this.expiresAt();
    if (!expiresAt) return '';
    const time = new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return this.t()['sources.extension.expiresAt'].replace('{time}', time);
  });

  toggle(): void {
    this.open.update((open) => !open);
    if (this.open() && !this.devicesLoaded) this.loadDevices();
  }

  generate(): void {
    if (this.generating()) return;
    this.generating.set(true);
    this.error.set(null);
    this.copied.set(false);
    this.extension.createPairingChallenge().subscribe({
      next: (challenge: ExtensionPairingChallenge) => {
        this.generating.set(false);
        this.code.set(challenge.code);
        this.expiresAt.set(challenge.expiresAt);
      },
      error: () => {
        this.generating.set(false);
        this.error.set('sources.extension.generateFailed');
      },
    });
  }

  copyCode(): void {
    const value = this.code();
    if (!value || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(value)
      .then(() => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      })
      .catch(() => undefined);
  }

  loadDevices(): void {
    if (this.devicesLoading()) return;
    this.devicesLoading.set(true);
    this.extension.listDevices().subscribe({
      next: (list) => {
        this.devices.set(list.devices);
        this.devicesLoaded = true;
        this.devicesLoading.set(false);
      },
      error: () => this.devicesLoading.set(false),
    });
  }

  revoke(device: ExtensionDevice): void {
    if (this.revokingId()) return;
    this.revokingId.set(device.id);
    this.error.set(null);
    this.extension.revokeDevice(device.id).subscribe({
      next: (list) => {
        this.revokingId.set(null);
        this.devices.set(list.devices);
      },
      error: () => {
        this.revokingId.set(null);
        this.error.set('sources.extension.revokeFailed');
      },
    });
  }

  lastUsedLabel(device: ExtensionDevice): string {
    if (!device.lastUsedAt) return this.t()['sources.extension.neverUsed'];
    const time = new Date(device.lastUsedAt).toLocaleString();
    return this.t()['sources.extension.lastUsed'].replace('{time}', time);
  }

  /** Error keys are translated when known; anything else passes through. */
  errorLabel(key: string): string {
    const value = this.t()[key];
    return value ? value : key;
  }
}
