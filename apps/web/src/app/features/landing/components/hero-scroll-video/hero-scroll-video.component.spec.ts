import { TestBed } from '@angular/core/testing';
import { HeroScrollVideoComponent } from './hero-scroll-video.component';
import { ThemeService } from '../../../../core/layout/theme.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('HeroScrollVideoComponent', () => {
  let component: HeroScrollVideoComponent;
  let fixture: any;

  const mockThemeService = {
    effectiveTheme: jasmine.createSpy('effectiveTheme').and.returnValue('light'),
  };

  const mockI18nService = {
    t: jasmine.createSpy('t').and.returnValue({
      'hero.title': 'Test Title',
      'hero.subtitle': 'Test Subtitle',
      'hero.ctaPrimary': 'Test CTA',
      'hero.trustText': 'Test Trust',
    }),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HeroScrollVideoComponent],
      providers: [
        { provide: ThemeService, useValue: mockThemeService },
        { provide: I18nService, useValue: mockI18nService },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroScrollVideoComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have correct posterSrc', () => {
    expect(component.posterSrc).toBe('/media/hero-poster.webp');
  });

  it('should have empty videoSrc initially', () => {
    expect(component.videoSrc()).toBe('');
  });

  it('should have showVideo false initially', () => {
    expect(component.showVideo()).toBe(false);
  });

  it('should have mode default to loading', () => {
    expect(component.mode()).toBe('loading');
  });
});