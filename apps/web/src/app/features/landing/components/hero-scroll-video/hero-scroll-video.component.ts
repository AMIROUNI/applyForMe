import type { OnDestroy, AfterViewInit, ElementRef } from '@angular/core';
import { Component, inject, PLATFORM_ID, signal, computed, ViewChild } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ThemeService } from '../../../../core/layout/theme.service';
import { computeProgress, lerp, shouldSeek, smoothstep } from './hero-scroll-video.util';

export type HeroMode = 'scrub' | 'loop' | 'static' | 'loading';

interface NavigatorWithConnection extends Navigator {
  connection?: {
    effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
    saveData?: boolean;
    downlink?: number;
    rtt?: number;
  };
}

@Component({
  selector: 'app-hero-scroll-video',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './hero-scroll-video.component.html',
  styleUrl: './hero-scroll-video.component.scss',
})
export class HeroScrollVideoComponent implements AfterViewInit, OnDestroy {
  private readonly i18n = inject(I18nService);
  private readonly themeService = inject(ThemeService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('sectionEl') sectionEl!: ElementRef<HTMLElement>;

  t = computed(() => this.i18n.t());
  isDark = computed(() => this.themeService.effectiveTheme() === 'dark');

  posterSrc = '/media/hero-poster.webp';
  videoSrc = signal<string>('');
  showVideo = signal(false);

  mode = signal<HeroMode>('loading');
  ready = signal(false);
  videoDuration = signal(0);
  progress = signal(0);
  targetProgress = signal(0);
  currentTime = signal(0);
  sectionMetrics = signal({ top: 0, height: 0, viewportHeight: 0 });

  private rafId: number | null = null;
  private scrollListener: (() => void) | null = null;
  private resizeListener: (() => void) | null = null;
  private visibilityListener: (() => void) | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private heroObserver: IntersectionObserver | null = null;
  private isSectionVisible = false;
  private isTabHidden = false;
  private videoLoaded = false;

  private readonly LERP_FACTOR = 0.12;

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.detectMode();
      this.setupHeroVisibility();
      this.scheduleVideoLoad();
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private detectMode(): void {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    const isNarrow = window.innerWidth < 768;
    const nav = navigator as NavigatorWithConnection;
    const saveData = nav.connection?.saveData === true;
    const effectiveType = nav.connection?.effectiveType;
    const isSlowConnection =
      effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g';

    if (prefersReduced || saveData || isSlowConnection) {
      this.mode.set('static');
    } else if (isCoarse || isNarrow) {
      this.mode.set('loop');
    } else {
      this.mode.set('scrub');
    }
  }

  private setupHeroVisibility(): void {
    if (!this.sectionEl?.nativeElement) return;
    this.heroObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !this.videoLoaded) {
            this.loadVideo();
            this.heroObserver?.unobserve(this.sectionEl!.nativeElement);
          }
        }
      },
      { rootMargin: '100px', threshold: 0 },
    );
    this.heroObserver.observe(this.sectionEl.nativeElement);
  }

  private scheduleVideoLoad(): void {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => this.maybeLoadVideoEarly(), { timeout: 2000 });
    } else {
      setTimeout(() => this.maybeLoadVideoEarly(), 100);
    }
  }

  private maybeLoadVideoEarly(): void {
    if (document.readyState === 'complete' && this.sectionEl?.nativeElement && !this.videoLoaded) {
      const rect = this.sectionEl.nativeElement.getBoundingClientRect();
      if (rect.top < window.innerHeight + 200) {
        this.loadVideo();
      }
    }
  }

  private loadVideo(): void {
    const video = this.videoEl?.nativeElement;
    if (!video || this.mode() === 'static' || this.videoLoaded) return;

    this.videoLoaded = true;

    const src = this.mode() === 'loop' ? '/media/hero-loop.mp4' : '/media/hero-scrub.mp4';
    this.videoSrc.set(src);
    this.showVideo.set(true);

    video.muted = true;
    video.playsInline = true;
    video.preload = this.mode() === 'loop' ? 'auto' : 'metadata';

    video.addEventListener('loadedmetadata', () => {
      this.videoDuration.set(video.duration);
      this.ready.set(true);
      this.computeSectionMetrics();
    });

    video.addEventListener('canplay', () => {
      if (video.readyState >= 2) {
        this.ready.set(true);
      }
    });

    video.addEventListener('error', () => {
      this.mode.set('static');
      this.showVideo.set(false);
      this.videoLoaded = false;
    });

    if (this.mode() === 'scrub') {
      this.setupVideoForScrub(video);
    } else if (this.mode() === 'loop') {
      this.setupVideoForLoop(video);
    }
  }

  private setupVideoForScrub(_video: HTMLVideoElement): void {
    this.computeSectionMetrics();
    this.setupScroll();
    this.setupIntersectionObserver();
    this.setupVisibility();
    this.startRafLoop();
  }

  private setupVideoForLoop(video: HTMLVideoElement): void {
    const loopObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      },
      { rootMargin: '50px', threshold: 0.1 },
    );
    loopObserver.observe(video);
  }

  private computeSectionMetrics(): void {
    if (!this.isBrowser || !this.sectionEl?.nativeElement) return;
    const rect = this.sectionEl.nativeElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    this.sectionMetrics.set({
      top: rect.top + window.scrollY,
      height: rect.height,
      viewportHeight,
    });
  }

  private setupScroll(): void {
    this.computeSectionMetrics();
    this.scrollListener = () => {
      if (!this.isSectionVisible || this.isTabHidden) return;
      const { top, height, viewportHeight } = this.sectionMetrics();
      const scrollY = window.scrollY;
      this.targetProgress.set(computeProgress(scrollY, top, height, viewportHeight));
    };
    window.addEventListener('scroll', this.scrollListener, { passive: true });

    this.resizeListener = () => {
      this.computeSectionMetrics();
    };
    window.addEventListener('resize', this.resizeListener, { passive: true });
  }

  private setupIntersectionObserver(): void {
    if (!this.sectionEl?.nativeElement) return;
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          this.isSectionVisible = entry.isIntersecting;
        }
      },
      { rootMargin: '0px', threshold: 0 },
    );
    this.intersectionObserver.observe(this.sectionEl.nativeElement);
  }

  private setupVisibility(): void {
    this.visibilityListener = () => {
      this.isTabHidden = document.hidden;
    };
    document.addEventListener('visibilitychange', this.visibilityListener);
  }

  private startRafLoop(): void {
    const loop = () => {
      if (this.mode() === 'scrub' && this.ready()) {
        const target = this.targetProgress();
        const current = this.progress();
        const smoothed = lerp(current, target, this.LERP_FACTOR);
        this.progress.set(smoothed);

        const video = this.videoEl?.nativeElement;
        if (video && this.videoDuration() > 0) {
          const targetTime = smoothed * this.videoDuration();
          if (shouldSeek(video.currentTime, targetTime, this.videoDuration())) {
            video.currentTime = targetTime;
            this.currentTime.set(targetTime);
          }
        }
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private cleanup(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
      this.scrollListener = null;
    }
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      this.resizeListener = null;
    }
    if (this.visibilityListener) {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    if (this.heroObserver) {
      this.heroObserver.disconnect();
      this.heroObserver = null;
    }
  }

  getScrimStyle() {
    return {
      background: `linear-gradient(90deg, var(--color-scrim-strong) 0%, var(--color-scrim) 45%, var(--color-scrim-soft) 65%, transparent)`,
    };
  }

  getTextOpacity(): number {
    const p = this.progress();
    return 1 - smoothstep(0.6, 0.9, p);
  }

  getTextTransform(): string {
    const p = this.progress();
    const offset = smoothstep(0.6, 0.9, p) * 40;
    return `translateY(-${offset}px)`;
  }

  onVideoLoaded(): void {
    this.ready.set(true);
  }

  onVideoError(): void {
    this.mode.set('static');
    this.showVideo.set(false);
  }

  onCtaClick(): void {
    console.log('Hero CTA clicked');
  }
}
