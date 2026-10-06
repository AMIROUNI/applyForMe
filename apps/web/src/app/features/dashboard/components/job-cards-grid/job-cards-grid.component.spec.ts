import { TestBed } from '@angular/core/testing';
import { JobCardsGridComponent } from './job-cards-grid.component';
import { I18nService } from '../../../../core/i18n/i18n.service';
import type { Job } from '@shared';

const job = (id: string, score = 80): Job => ({
  id,
  urlHash: `hash-${id}`,
  sourceId: 'linkedin',
  sourceName: 'LinkedIn',
  title: `Job ${id}`,
  company: 'Acme',
  location: 'Tunis',
  country: 'tn',
  description: 'Description',
  url: `https://example.com/${id}`,
  postedAt: '2026-10-01T00:00:00.000Z',
  scrapedAt: '2026-10-02T00:00:00.000Z',
  experienceLevel: 'mid',
  remoteType: 'remote',
  jobType: 'full-time',
  salary: null,
  skills: [],
  applyMethod: 'external',
  matchScore: score,
  matchReason: '',
  status: 'new',
});

describe('JobCardsGridComponent', () => {
  const mockI18n = {
    t: jasmine
      .createSpy('t')
      .and.returnValue(new Proxy({}, { get: (_t, key: string) => String(key) })),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JobCardsGridComponent],
      providers: [{ provide: I18nService, useValue: mockI18n }],
    }).compileComponents();
  });

  it('renders skeleton cards while loading with no results', () => {
    const fixture = TestBed.createComponent(JobCardsGridComponent);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const skeletons = fixture.nativeElement.querySelectorAll('.grid__skeleton');
    expect(skeletons.length).toBe(6);
  });

  it('renders the empty state when there are no jobs', () => {
    const fixture = TestBed.createComponent(JobCardsGridComponent);
    fixture.componentRef.setInput('jobs', []);
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();

    const empty = fixture.nativeElement.querySelector('app-empty-state');
    expect(empty).toBeTruthy();
  });

  it('renders one card per job and a results count', () => {
    const fixture = TestBed.createComponent(JobCardsGridComponent);
    fixture.componentRef.setInput('jobs', [job('a'), job('b', 95)]);
    fixture.componentRef.setInput('total', 2);
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('app-job-card');
    expect(cards.length).toBe(2);

    const count: HTMLElement = fixture.nativeElement.querySelector('.grid__count');
    expect(count.textContent).toContain('2');
  });

  it('shows the load more button when there are more pages', () => {
    const fixture = TestBed.createComponent(JobCardsGridComponent);
    fixture.componentRef.setInput('jobs', [job('a')]);
    fixture.componentRef.setInput('hasMore', true);
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.grid__more button');
    expect(button).toBeTruthy();

    spyOn(fixture.componentInstance.loadMore, 'emit');
    button.click();
    expect(fixture.componentInstance.loadMore.emit).toHaveBeenCalled();
  });

  it('offers to clear the search when results are empty after a search', () => {
    const fixture = TestBed.createComponent(JobCardsGridComponent);
    fixture.componentRef.setInput('jobs', []);
    fixture.componentRef.setInput('hasActiveSearch', true);
    fixture.detectChanges();

    const clearBtn: HTMLButtonElement =
      fixture.nativeElement.querySelector('app-empty-state button');
    expect(clearBtn).toBeTruthy();

    spyOn(fixture.componentInstance.resetSearch, 'emit');
    clearBtn.click();
    expect(fixture.componentInstance.resetSearch.emit).toHaveBeenCalled();
  });
});
