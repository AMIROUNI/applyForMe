import { Component, inject, PLATFORM_ID, afterNextRender } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { ThemeService } from './core/layout/theme.service';
import { I18nService } from './core/i18n/i18n.service';
import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html'
})
export class App {
  private platformId = inject(PLATFORM_ID);
  private themeService = inject(ThemeService);
  private i18n = inject(I18nService);
  private auth = inject(AuthService);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      afterNextRender(() => {
        this.auth.checkSession();
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
}
