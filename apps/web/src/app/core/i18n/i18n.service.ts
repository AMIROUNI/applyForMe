import { Injectable, signal, computed, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Locale = 'en' | 'fr';

export interface TranslationDict {
  [key: string]: string;
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly STORAGE_KEY = 'lang';
  private translations = new Map<Locale, TranslationDict>();

  lang = signal<Locale>('en');

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      this.init();
    }
  }

  private init(): void {
    const stored = this.getStoredLang();
    if (stored) {
      this.lang.set(stored);
    } else {
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('fr')) {
        this.lang.set('fr');
      }
    }
    this.applyLang();
  }

  private getStoredLang(): Locale | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored === 'en' || stored === 'fr') {
        return stored;
      }
    } catch {
      // ignore
    }
    return null;
  }

  registerTranslations(locale: Locale, dict: TranslationDict): void {
    this.translations.set(locale, dict);
  }

  t = computed(() => {
    const currentLang = this.lang();
    return this.translations.get(currentLang) ?? this.translations.get('en') ?? {};
  });

  setLang(locale: Locale): void {
    this.lang.set(locale);
    try {
      localStorage.setItem(this.STORAGE_KEY, locale);
    } catch {
      // ignore
    }
    this.applyLang();
  }

  private applyLang(): void {
    document.documentElement.setAttribute('lang', this.lang());
  }
}