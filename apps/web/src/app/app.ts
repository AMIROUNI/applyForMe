import { Component, inject, PLATFORM_ID, afterNextRender } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ThemeService } from './core/layout/theme.service';
import { I18nService } from './core/i18n/i18n.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html'
})
export class App {
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);
  private themeService = inject(ThemeService);
  private i18n = inject(I18nService);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      afterNextRender(() => {
        this.checkSession();
        this.hideSplash();
      });
    }
  }

  private hideSplash(): void {
    const splash = document.querySelector('.app-splash');
    if (splash) {
      splash.classList.add('app-splash--hidden');
      splash.addEventListener('transitionend', () => splash.remove(), { once: true });
    }
  }

  private checkSession(): void {
    this.http.get('/api/v1/me').subscribe({
      next: () => {
        console.log('Session valid');
      },
      error: (err) => {
        if (err.status === 401 || err.status === 403) {
          console.log('No valid session');
        } else if (err.name === 'TimeoutError') {
          console.warn('Session check timed out after 5s');
        } else {
          console.warn('Session check failed:', err.message);
        }
      }
    });
  }
}