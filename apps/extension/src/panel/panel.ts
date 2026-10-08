import type { ExtensionTaskAssignment } from '@agency-apply/shared';
import { ApiError, ExtensionApi } from '../lib/api';
import { hostOf } from '../lib/hosts';
import { DEFAULT_API_BASE, PAGE_CAP } from '../lib/limits';
import {
  clearPairing,
  loadSettings,
  rememberHost,
  saveSettings,
  type StoredSettings,
} from '../lib/storage';
import { createExtractPort, createRunnerApi, createTabsPort } from './ports';
import { runTasks, type RunnerDeps, type RunnerProgressEvent, type TaskOutcome } from './runner';
import { createStrings, detectLang, format } from './strings';

const byId = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
};

const t = createStrings(detectLang());

const el = {
  pairing: byId('pairing'),
  collector: byId('collector'),
  pairingHint: byId('pairing-hint'),
  apiBaseLabel: byId('api-base-label'),
  apiBase: byId<HTMLInputElement>('api-base'),
  codeLabel: byId('code-label'),
  code: byId<HTMLInputElement>('code'),
  pairingError: byId('pairing-error'),
  pair: byId<HTMLButtonElement>('pair'),
  disconnect: byId<HTMLButtonElement>('disconnect'),
  tasksTitle: byId('tasks-title'),
  taskList: byId<HTMLUListElement>('task-list'),
  noTasks: byId('no-tasks'),
  progress: byId('progress'),
  progressLine: byId('progress-line'),
  progressItems: byId('progress-items'),
  keepOpen: byId('keep-open'),
  runSummary: byId('run-summary'),
  runError: byId('run-error'),
  start: byId<HTMLButtonElement>('start'),
  stop: byId<HTMLButtonElement>('stop'),
  refresh: byId<HTMLButtonElement>('refresh'),
  consent: byId('consent'),
  consentTitle: byId('consent-title'),
  consentBody: byId('consent-body'),
  consentAllow: byId<HTMLButtonElement>('consent-allow'),
  consentCancel: byId<HTMLButtonElement>('consent-cancel'),
};

let settings: StoredSettings | null = null;
let api: ExtensionApi | null = null;
let tasks: ExtensionTaskAssignment[] = [];
let running = false;
let stopRequested = false;
let consentResolve: ((allowed: boolean) => void) | null = null;

const statusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: t.statusPending,
    running: t.statusRunning,
    done: t.statusDone,
    blocked: t.statusBlocked,
    failed: t.statusFailed,
    skipped: t.statusSkipped,
    cancelled: t.statusCancelled,
  };
  return labels[status] ?? status;
};

const showError = (node: HTMLElement, message: string): void => {
  node.textContent = message;
  node.hidden = false;
};

const hide = (node: HTMLElement): void => {
  node.hidden = true;
};

const applyLabels = (): void => {
  el.pairingHint.textContent = t.pairingHint;
  el.apiBaseLabel.textContent = t.apiBase;
  el.codeLabel.textContent = t.codeLabel;
  el.code.placeholder = t.codePlaceholder;
  el.pair.textContent = t.connect;
  el.disconnect.textContent = t.disconnect;
  el.tasksTitle.textContent = t.tasksTitle;
  el.noTasks.textContent = t.noTasks;
  el.start.textContent = t.start;
  el.stop.textContent = t.stop;
  el.refresh.textContent = t.refresh;
  el.keepOpen.textContent = t.keepOpen;
  el.consentTitle.textContent = t.consentTitle;
  el.consentAllow.textContent = t.consentAllow;
  el.consentCancel.textContent = t.consentCancel;
  el.apiBase.placeholder = DEFAULT_API_BASE;
};

const showPairing = (message?: string): void => {
  el.collector.hidden = true;
  el.pairing.hidden = false;
  el.disconnect.hidden = true;
  el.apiBase.value = settings?.apiBase ?? DEFAULT_API_BASE;
  if (message) showError(el.pairingError, message);
  else hide(el.pairingError);
};

const showCollector = (): void => {
  el.pairing.hidden = true;
  el.collector.hidden = false;
  el.disconnect.hidden = false;
};

const connectApi = (): ExtensionApi | null => {
  if (!settings?.token) return null;
  api = new ExtensionApi(settings.apiBase, settings.token);
  return api;
};

const renderTasks = (): void => {
  el.taskList.textContent = '';
  for (const task of tasks) {
    const item = document.createElement('li');
    const source = document.createElement('span');
    source.className = 'task-source';
    source.textContent = task.source;
    const state = document.createElement('span');
    state.className = 'task-state';
    state.dataset.taskId = task.taskId;
    state.textContent = statusLabel(task.status);
    item.append(source, state);
    el.taskList.append(item);
  }
  hide(el.noTasks);
  if (tasks.length === 0 && !running) el.noTasks.hidden = false;
  el.start.disabled = running || tasks.length === 0;
  el.refresh.disabled = running;
};

const updateTaskState = (taskId: string, label: string): void => {
  for (const node of el.taskList.querySelectorAll<HTMLElement>('.task-state')) {
    if (node.dataset.taskId === taskId) node.textContent = label;
  }
};

const handleApiFailure = (error: unknown, onOther: (message: string) => void): void => {
  if (error instanceof ApiError && error.status === 401) {
    void (async () => {
      await clearPairing();
      settings = await loadSettings();
      api = null;
      tasks = [];
      showPairing(t.tokenRejected);
    })();
    return;
  }
  if (error instanceof ApiError && error.status === 0) {
    onOther(t.networkFailed);
    return;
  }
  onOther(error instanceof Error ? error.message : String(error));
};

const refresh = async (): Promise<void> => {
  const client = connectApi();
  if (!client) return;
  try {
    tasks = await client.listTasks();
    hide(el.runError);
    renderTasks();
  } catch (error) {
    handleApiFailure(error, message => showError(el.runError, message));
  }
};

const onPair = async (): Promise<void> => {
  const base = el.apiBase.value.trim() || DEFAULT_API_BASE;
  const code = el.code.value.trim();
  if (!code) {
    showError(el.pairingError, t.connectFailed);
    return;
  }
  el.pair.disabled = true;
  try {
    const guest = new ExtensionApi(base, null);
    const result = await guest.pair(code, 'Browser extension');
    await saveSettings({ apiBase: base, token: result.token, deviceId: result.deviceId });
    settings = await loadSettings();
    showCollector();
    await refresh();
  } catch (error) {
    handleApiFailure(error, message =>
      showError(
        el.pairingError,
        message === t.networkFailed ? message : `${t.connectFailed} — ${message}`
      )
    );
  } finally {
    el.pair.disabled = false;
  }
};

const confirmSites = (hosts: string[]): Promise<boolean> =>
  new Promise(resolve => {
    consentResolve = resolve;
    el.consentBody.textContent = format(t.consentBody, { hosts: hosts.join(', ') });
    el.consent.hidden = false;
  });

const settleConsent = (allowed: boolean): void => {
  el.consent.hidden = true;
  const resolve = consentResolve;
  consentResolve = null;
  resolve?.(allowed);
};

const summarize = (outcomes: TaskOutcome[]): Record<string, number> => ({
  done: outcomes.filter(outcome => outcome.status === 'done').length,
  blocked: outcomes.filter(outcome => outcome.status === 'blocked').length,
  failed: outcomes.filter(outcome => outcome.status === 'failed').length,
  cancelled: outcomes.filter(outcome => outcome.status === 'cancelled').length,
});

const handleProgress = (event: RunnerProgressEvent): void => {
  if (event.type === 'task') {
    updateTaskState(event.taskId, statusLabel(event.status));
    if (event.status === 'running') el.progress.hidden = false;
    return;
  }
  el.progress.hidden = false;
  if (event.type === 'page') {
    el.progressLine.textContent = format(t.pageLabel, { page: event.page, cap: PAGE_CAP });
    el.progressItems.textContent = format(t.itemsLabel, { items: event.total });
    return;
  }
  el.progressItems.textContent = format(t.itemsLabel, { items: event.total });
};

const onStart = async (): Promise<void> => {
  const current = settings;
  if (running || !current) return;
  const client = connectApi();
  if (!client) return;

  const newHosts = [
    ...new Set(
      tasks
        .map(task => hostOf(task.searchUrl))
        .filter(
          (host): host is string => Boolean(host) && !current.knownHosts.includes(host as string)
        )
    ),
  ];
  if (newHosts.length > 0) {
    const allowed = await confirmSites(newHosts);
    if (!allowed) return;
    for (const host of newHosts) await rememberHost(host);
    settings = await loadSettings();
  }

  running = true;
  stopRequested = false;
  hide(el.runSummary);
  hide(el.runError);
  el.keepOpen.hidden = false;
  el.progress.hidden = false;
  el.progressLine.textContent = t.statusRunning;
  el.progressItems.textContent = '';
  el.stop.disabled = false;
  el.stop.hidden = false;
  el.start.disabled = true;

  const deps: RunnerDeps = {
    api: createRunnerApi(client),
    tabs: createTabsPort(),
    extract: createExtractPort(),
    delay: (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms)),
    rng: Math.random,
    isStopped: (): boolean => stopRequested,
    onProgress: handleProgress,
  };

  try {
    const outcomes = await runTasks(tasks, deps);
    el.runSummary.textContent = format(t.summary, summarize(outcomes));
    el.runSummary.hidden = false;
    const firstFailure = outcomes.find(outcome => outcome.status === 'failed');
    if (firstFailure) showError(el.runError, `${t.runFailed} — ${firstFailure.message}`);
  } catch (error) {
    handleApiFailure(error, message => showError(el.runError, message));
  } finally {
    running = false;
    el.stop.hidden = true;
    el.keepOpen.hidden = true;
    el.progress.hidden = true;
    renderTasks();
    await refresh();
  }
};

const onDisconnect = async (): Promise<void> => {
  el.disconnect.disabled = true;
  try {
    if (settings?.deviceId && api) await api.deleteDevice(settings.deviceId);
  } catch {
    // Disconnecting locally matters even when the API call fails.
  }
  await clearPairing();
  settings = await loadSettings();
  api = null;
  tasks = [];
  el.disconnect.disabled = false;
  showPairing();
};

const bind = (): void => {
  el.pair.addEventListener('click', () => void onPair());
  el.code.addEventListener('keydown', event => {
    if (event.key === 'Enter') void onPair();
  });
  el.refresh.addEventListener('click', () => void refresh());
  el.start.addEventListener('click', () => void onStart());
  el.stop.addEventListener('click', () => {
    stopRequested = true;
    el.stop.disabled = true;
  });
  el.disconnect.addEventListener('click', () => void onDisconnect());
  el.consentAllow.addEventListener('click', () => settleConsent(true));
  el.consentCancel.addEventListener('click', () => settleConsent(false));
};

const main = async (): Promise<void> => {
  applyLabels();
  bind();
  settings = await loadSettings();
  if (settings.token) {
    showCollector();
    await refresh();
  } else {
    showPairing();
  }
};

void main();
