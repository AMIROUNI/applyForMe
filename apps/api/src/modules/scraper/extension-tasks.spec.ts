import type { ExtensionTask } from '@agency-apply/shared';
import {
  applyTaskUpdate,
  areTasksTerminal,
  canTransitionExtensionTask,
  terminalisesTask,
} from './extension-tasks';

const task = (status: ExtensionTask['status']): ExtensionTask => ({
  id: 'task-1',
  source: 'linkedin_jobs',
  status,
  searchUrl: 'https://www.linkedin.com/jobs/search?keywords=react',
  pagesCaptured: 0,
  itemsFound: 0,
  message: '',
  startedAt: null,
  finishedAt: null,
});

describe('extension task state machine', () => {
  it('walks the happy path pending -> running -> done', () => {
    expect(canTransitionExtensionTask('pending', 'running')).toBe(true);
    expect(canTransitionExtensionTask('running', 'done')).toBe(true);
    expect(canTransitionExtensionTask('pending', 'done')).toBe(false);
  });

  it('lets a user skip or cancel from any live state', () => {
    for (const status of ['pending', 'running', 'blocked', 'failed', 'skipped'] as const) {
      expect(canTransitionExtensionTask(status, 'cancelled')).toBe(true);
    }
    expect(canTransitionExtensionTask('done', 'cancelled')).toBe(false);
    expect(canTransitionExtensionTask('cancelled', 'running')).toBe(false);
  });

  it('allows a retry only from a blocked, failed or skipped task', () => {
    expect(canTransitionExtensionTask('blocked', 'running')).toBe(true);
    expect(canTransitionExtensionTask('failed', 'running')).toBe(true);
    expect(canTransitionExtensionTask('skipped', 'running')).toBe(true);
    expect(canTransitionExtensionTask('done', 'running')).toBe(false);
    expect(canTransitionExtensionTask('pending', 'running')).toBe(true);
  });

  it('refuses an illegal transition with a reason', () => {
    const result = applyTaskUpdate(task('done'), { status: 'running' });
    expect(result.ok).toBe(false);
    expect(result.task.status).toBe('done');
    expect(result.reason).toContain('done task to running');
  });

  it('stamps startedAt on running and finishedAt once on the first terminal state', () => {
    const started = applyTaskUpdate(task('pending'), { status: 'running' });
    expect(started.ok).toBe(true);
    expect(started.task.startedAt).toBeInstanceOf(Date);
    expect(started.becameTerminal).toBe(false);

    const blocked = applyTaskUpdate(started.task, {
      status: 'blocked',
      message: 'LinkedIn asked for verification',
    });
    expect(blocked.becameTerminal).toBe(true);
    expect(blocked.task.finishedAt).toBeInstanceOf(Date);
    expect(blocked.task.message).toBe('LinkedIn asked for verification');
    expect(blocked.task.startedAt).toEqual(started.task.startedAt);
  });

  it('fills a clear default message when the extension sends none', () => {
    const result = applyTaskUpdate(task('running'), { status: 'blocked' });
    expect(result.task.message).toContain('login wall');
  });

  it('resets page progress when a terminal task is retried', () => {
    const running = applyTaskUpdate(task('pending'), { status: 'running', pagesCaptured: 3 });
    const blocked = applyTaskUpdate(running.task, { status: 'blocked', pagesCaptured: 1 });
    const retried = applyTaskUpdate(blocked.task, { status: 'running' });

    expect(retried.task.pagesCaptured).toBe(0);
    expect(retried.task.finishedAt).toBeNull();
    expect(retried.task.message).toBe('');
    expect(retried.task.startedAt).toBeInstanceOf(Date);
  });

  it('applies counts without touching the status', () => {
    const running = applyTaskUpdate(task('pending'), { status: 'running' });
    const counted = applyTaskUpdate(running.task, { pagesCaptured: 2, itemsFound: 17 });
    expect(counted.task).toMatchObject({ status: 'running', pagesCaptured: 2, itemsFound: 17 });
    expect(counted.becameTerminal).toBe(false);
  });

  it('counts a run as finished only when every task is terminal', () => {
    expect(areTasksTerminal([task('done'), task('skipped')])).toBe(true);
    expect(areTasksTerminal([task('done'), task('running')])).toBe(false);
    expect(areTasksTerminal([task('pending')])).toBe(false);
    expect(areTasksTerminal([])).toBe(true);
  });

  it('marks the first terminal transition as the one that finishes a unit', () => {
    expect(terminalisesTask('running', 'done')).toBe(true);
    expect(terminalisesTask('done', 'done')).toBe(false);
    expect(terminalisesTask('pending', 'skipped')).toBe(true);
  });
});
