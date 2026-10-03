import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { I18nService } from './core/i18n/i18n.service';
import { enTranslations } from './core/i18n/translations.en';
import { frTranslations } from './core/i18n/translations.fr';
import { routes } from './app.routes';

function initializeI18n(i18n: I18nService): () => void {
  return () => {
    i18n.registerTranslations('en', enTranslations);
    i18n.registerTranslations('fr', frTranslations);
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeI18n,
      deps: [I18nService],
      multi: true
    }
  ]
};