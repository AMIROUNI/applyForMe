import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LandingHeaderComponent } from './components/landing-header.component';
import { LandingHeroComponent } from './components/landing-hero.component';
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
    LandingHeroComponent,
    LandingHowItWorksComponent,
    LandingFeaturesComponent,
    LandingCtaComponent,
    LandingFooterComponent
  ],
  template: `
    <div class="landing-page">
      <app-landing-header></app-landing-header>
      <main class="landing-page__main">
        <app-landing-hero></app-landing-hero>
        <app-landing-how-it-works></app-landing-how-it-works>
        <app-landing-features></app-landing-features>
        <app-landing-cta></app-landing-cta>
      </main>
      <app-landing-footer></app-landing-footer>
    </div>
  `,
  styles: [`
    .landing-page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .landing-page__main {
      flex: 1;
    }
  `]
})
export class LandingPageComponent {}