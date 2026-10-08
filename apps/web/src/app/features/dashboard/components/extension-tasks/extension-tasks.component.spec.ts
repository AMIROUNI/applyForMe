import { TestBed } from '@angular/core/testing';
import { ExtensionTasksComponent } from './extension-tasks.component';
import { I18nService } from '../../../../core/i18n/i18n.service';
import type { ExtensionTask, ExtensionTaskStatus, ScraperRun } from '@shared';

const task = (id: string, status: ExtensionTaskStatus): ExtensionTask => ({
  id,
  source: 'linkedin_jobs',
  status,
  searchUrl: 'https://www.linkedin.com/jobs/search/?keywords=react',
  pagesCaptured: 2,
  itemsFound: 7,
  message: status === 'blocked' ? 'Stopped by a login wall' : '',
  startedAt: null,
  finishedAt: null,
});

const runWith = (tasks: ExtensionTask[]): ScraperRun => ({
  id: 'run-1',
  status: 'running',
  sources: ['linkedin_jobs'],
  keywords: ['react'],
  countries: [],
  remoteOnly: false,
  progress: { total: tasks.length, done: 0, found: 0 },
  errors: [],
  extensionTasks: tasks,
  startedAt: null,
  finishedAt: null,
});

const buttonLabels = (el: Element): string[] =>
  [...el.querySelectorAll('.task__action')].map((b) => b.textContent?.trim() ?? '');

describe('ExtensionTasksComponent', () => {
  const mockI18n = {
    t: jasmine
      .createSpy('t')
      .and.returnValue(new Proxy({}, { get: (_t, key: string) => String(key) })),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExtensionTasksComponent],
      providers: [{ provide: I18nService, useValue: mockI18n }],
    }).compileComponents();
  });

  it('renders one row per task with its source label', () => {
    const fixture = TestBed.createComponent(ExtensionTasksComponent);
    fixture.componentRef.setInput('run', runWith([task('a', 'pending'), task('b', 'done')]));
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.task');
    expect(rows.length).toBe(2);
    const sources = [...fixture.nativeElement.querySelectorAll('.task__source')].map((el) =>
      el.textContent?.trim(),
    );
    expect(sources[0]).toBe('source.linkedinJobs');
  });

  it('offers skip and cancel for a pending task', () => {
    const fixture = TestBed.createComponent(ExtensionTasksComponent);
    fixture.componentRef.setInput('run', runWith([task('a', 'pending')]));
    fixture.detectChanges();

    expect(buttonLabels(fixture.nativeElement)).toEqual([
      'extension.tasks.action.skip',
      'extension.tasks.action.cancel',
    ]);
  });

  it('offers retry and cancel for a blocked task, nothing for a done one', () => {
    const fixture = TestBed.createComponent(ExtensionTasksComponent);
    fixture.componentRef.setInput('run', runWith([task('a', 'blocked'), task('b', 'done')]));
    fixture.detectChanges();

    expect(buttonLabels(fixture.nativeElement)).toEqual([
      'extension.tasks.action.retry',
      'extension.tasks.action.cancel',
    ]);
  });

  it('emits the chosen action with the task id', () => {
    const fixture = TestBed.createComponent(ExtensionTasksComponent);
    fixture.componentRef.setInput('run', runWith([task('a', 'failed')]));
    fixture.detectChanges();

    spyOn(fixture.componentInstance.action, 'emit');
    const retry: HTMLButtonElement = fixture.nativeElement.querySelector('.task__action');
    retry.click();

    expect(fixture.componentInstance.action.emit).toHaveBeenCalledWith({
      taskId: 'a',
      action: 'retry',
    });
  });

  it('disables action buttons while another action is in flight', () => {
    const fixture = TestBed.createComponent(ExtensionTasksComponent);
    fixture.componentRef.setInput('run', runWith([task('a', 'pending')]));
    fixture.componentRef.setInput('pendingId', 'other');
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.task__action');
    expect(button.disabled).toBe(true);
  });

  it('shows the browser hint while tasks wait, and hides it when all are terminal', () => {
    const fixture = TestBed.createComponent(ExtensionTasksComponent);
    fixture.componentRef.setInput('run', runWith([task('a', 'running')]));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tasks__hint')).toBeTruthy();

    fixture.componentRef.setInput('run', runWith([task('a', 'done')]));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tasks__hint')).toBeNull();
  });

  it('surfaces the action error message', () => {
    const fixture = TestBed.createComponent(ExtensionTasksComponent);
    fixture.componentRef.setInput('run', runWith([task('a', 'pending')]));
    fixture.componentRef.setInput('error', 'extension.tasks.actionFailed');
    fixture.detectChanges();

    const error: HTMLElement = fixture.nativeElement.querySelector('.tasks__error');
    expect(error.textContent).toContain('extension.tasks.actionFailed');
  });
});
