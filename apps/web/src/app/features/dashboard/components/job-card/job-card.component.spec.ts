import { TestBed } from '@angular/core/testing';
import { JobCardComponent } from './job-card.component';
import { I18nService } from '../../../../core/i18n/i18n.service';
import type { Job } from '@shared';

const baseJob: Job = {
  id: 'job-1',
  urlHash: 'hash-1',
  sourceId: 'linkedin',
  sourceName: 'LinkedIn',
  title: 'Senior React Developer',
  company: 'Acme',
  location: 'Tunis',
  country: 'tn',
  description: 'Build dashboards with React and TypeScript.',
  url: 'https://example.com/job/1',
  postedAt: '2026-10-01T00:00:00.000Z',
  scrapedAt: '2026-10-02T00:00:00.000Z',
  experienceLevel: 'senior',
  remoteType: 'hybrid',
  jobType: 'full-time',
  salary: null,
  skills: ['React', 'TypeScript'],
  applyMethod: 'external',
  matchScore: 85,
  matchReason: 'Great fit',
  status: 'new',
};

describe('JobCardComponent', () => {
  let component: JobCardComponent;

  const mockI18n = {
    t: jasmine
      .createSpy('t')
      .and.returnValue(new Proxy({}, { get: (_target, key: string) => String(key) })),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JobCardComponent],
      providers: [{ provide: I18nService, useValue: mockI18n }],
    }).compileComponents();

    const fixture = TestBed.createComponent(JobCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('job', baseJob);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('maps score >= 75 to the high level', () => {
    expect(component.scoreLevel()).toBe('high');
    expect(component.scoreTone()).toBe('success');
  });

  it('maps score 50-74 to the mid level', () => {
    const fixture = TestBed.createComponent(JobCardComponent);
    fixture.componentRef.setInput('job', { ...baseJob, matchScore: 60 });
    fixture.detectChanges();
    expect(fixture.componentInstance.scoreLevel()).toBe('mid');
    expect(fixture.componentInstance.scoreTone()).toBe('info');
  });

  it('maps score < 50 to the low level', () => {
    const fixture = TestBed.createComponent(JobCardComponent);
    fixture.componentRef.setInput('job', { ...baseJob, matchScore: 30 });
    fixture.detectChanges();
    expect(fixture.componentInstance.scoreLevel()).toBe('low');
    expect(fixture.componentInstance.scoreTone()).toBe('warning');
  });

  it('maps job status to badge tones', () => {
    const fixture = TestBed.createComponent(JobCardComponent);
    fixture.componentRef.setInput('job', { ...baseJob, status: 'applied' });
    fixture.detectChanges();
    expect(fixture.componentInstance.statusTone()).toBe('success');
  });

  it('maps apply method to badge tones', () => {
    expect(component.methodTone()).toBe('info');
  });

  it('uses the first company letter as avatar', () => {
    expect(component.companyInitial()).toBe('A');
  });

  it('emits apply when the apply button is clicked', () => {
    const fixture = TestBed.createComponent(JobCardComponent);
    fixture.componentRef.setInput('job', baseJob);
    fixture.detectChanges();

    const applySpy = spyOn(fixture.componentInstance.apply, 'emit');
    const button: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      '.job-card__footer app-button button',
    );
    expect(button).toBeTruthy();
    button!.click();
    expect(applySpy).toHaveBeenCalledWith(baseJob);
  });

  it('renders the job title', () => {
    const fixture = TestBed.createComponent(JobCardComponent);
    fixture.componentRef.setInput('job', baseJob);
    fixture.detectChanges();
    const title: HTMLElement = fixture.nativeElement.querySelector('.job-card__title');
    expect(title.textContent).toContain('Senior React Developer');
  });
});
