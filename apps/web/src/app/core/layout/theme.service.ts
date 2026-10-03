import { Injectable, signal, computed, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemeMode = 'system' | 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'theme';
  private readonly MEDIA_QUERY = '(prefers-color-scheme: dark)';

  theme = signal<ThemeMode>('system');
  private systemDark = signal(false);
  private mediaQueryListener?: MediaQueryList;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      this.init();
    }
  }

  private init(): void {
    const stored = this.getStoredTheme();
    if (stored) {
      this.theme.set(stored);
    }

    this.systemDark.set(window.matchMedia(this.MEDIA_QUERY).matches);
    this.applyTheme();

    const mediaQuery = window.matchMedia(this.MEDIA_QUERY);
    const handler = (e: MediaQueryListEvent) => {
      this.systemDark.set(e.matches);
      if (this.theme() === 'system') {
        this.applyTheme();
      }
    };
    mediaQuery.addEventListener('change', handler);
    this.mediaQueryListener = mediaQuery;
  }

  private getStoredTheme(): ThemeMode | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored === 'system' || stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch {
      // localStorage unavailable
    }
    return null;
  }

  effectiveTheme = computed(() => {
    const theme = this.theme();
    if (theme === 'system') {
      return this.systemDark() ? 'dark' : 'light';
    }
    return theme;
  });

  setTheme(mode: ThemeMode): void {
    this.theme.set(mode);
    try {
      localStorage.setItem(this.STORAGE_KEY, mode);
    } catch {
      // ignore
    }
    this.applyTheme();
  }

  toggle(): void {
    const current = this.theme();
    const next: ThemeMode = current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system';
    this.setTheme(next);
  }

  private applyTheme(): void {
    const effective = this.effectiveTheme();
    document.documentElement.setAttribute('data-theme', effective);
  }

  ngOnDestroy(): void {
    if (this.mediaQueryListener) {
      this.mediaQueryListener.removeEventListener('change', () => {});
    }
  }
}

export function provideThemeInitializer(): void {
  // ThemeService is auto-initialized via providedIn: 'root'
  // The APP_INITIALIZER approach is not needed since we use signals and
  // the service constructor runs immediately in browser context
}