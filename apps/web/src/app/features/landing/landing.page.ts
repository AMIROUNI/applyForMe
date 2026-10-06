import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LandingHeaderComponent } from './components/landing-header.component';
import { HeroScrollVideoComponent } from './components/hero-scroll-video/hero-scroll-video.component';
import { LandingHowItWorksComponent } from './components/landing-how-it-works.component';
import { LandingFeaturesComponent } from './components/landing-features.component';
import { LandingCtaComponent } from './components/landing-cta.component';
import { LandingFooterComponent } from './components/landing-footer.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    CommonModule,
    LandingHeaderComponent,
    HeroScrollVideoComponent,
    LandingHowItWorksComponent,
    LandingFeaturesComponent,
    LandingCtaComponent,
    LandingFooterComponent,
  ],
  template: `
    <div class="landing-page">
      <app-landing-header></app-landing-header>
      <main class="landing-page__main">
        <app-hero-scroll-video></app-hero-scroll-video>
        <app-landing-how-it-works></app-landing-how-it-works>
        <app-landing-features></app-landing-features>
        <app-landing-cta></app-landing-cta>
      </main>
      <app-landing-footer></app-landing-footer>
    </div>
  `,
  styles: [
    `
      .landing-page {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }

      .landing-page__main {
        flex: 1;
      }
    `,
  ],
})
export class LandingPageComponent {
  constructor() {
    // Preload the hero poster only on the page that actually uses it,
    // so auth pages don't warn about an unused preloaded resource.
    if (typeof document !== 'undefined' && !document.querySelector('link[data-hero-poster]')) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = '/media/hero-poster.webp';
      link.setAttribute('data-hero-poster', '');
      document.head.appendChild(link);
    }
  }
}
