import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { isDevMode } from '@angular/core';

@Component({
  selector: 'app-dev-loading',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isDevMode()) {
      <div class="dev-loading-page">
        <h1>Dev Loading Test</h1>
        <p>This page simulates a slow /me response (3s delay)</p>
        <button (click)="testSlowMe()">Test Slow /me</button>
        <p class="result">{{ result() }}</p>
      </div>
    }
  `,
  styles: [
    `
      .dev-loading-page {
        padding: var(--spacing-8);
        max-width: 600px;
        margin: 0 auto;
        text-align: center;
      }
      button {
        margin-top: var(--spacing-4);
        padding: var(--spacing-3) var(--spacing-6);
        background: var(--color-primary-fill);
        color: var(--color-on-primary);
        border: none;
        border-radius: var(--radius-input);
        cursor: pointer;
      }
      .result {
        margin-top: var(--spacing-4);
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class DevLoadingPageComponent {
  private http = inject(HttpClient);
  result = signal('');

  testSlowMe(): void {
    this.result.set('Loading...');
    this.http.get('/api/v1/me').subscribe({
      next: () => this.result.set('Success!'),
      error: (err) => this.result.set('Error: ' + err.message),
    });
  }

  protected isDevMode = isDevMode;
}
