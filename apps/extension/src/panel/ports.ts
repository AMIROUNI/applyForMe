import type {
  ExtensionTaskAssignment,
  ExtensionTaskUpdate,
  IngestJobsRequest,
  IngestJobsResponse,
} from '@agency-apply/shared';
import type { ExtensionApi } from '../lib/api';
import { EXTRACT_ATTEMPTS, EXTRACT_RETRY_MS, LOAD_TIMEOUT_MS } from '../lib/limits';
import { ExtractUnavailable, type ExtractResponse } from '../lib/messages';
import type { ExtractPort, LoadResult, RunnerApi, TabsPort } from './runner';

const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export const createTabsPort = (): TabsPort => ({
  open: async (url: string): Promise<number> => {
    const tab = await chrome.tabs.create({ url, active: true });
    if (tab.id === undefined) throw new Error('The browser did not open a tab');
    return tab.id;
  },
  navigate: async (tabId: number, url: string): Promise<void> => {
    await chrome.tabs.update(tabId, { url, active: true });
  },
  waitForLoad: (tabId: number): Promise<LoadResult> =>
    new Promise(resolve => {
      let httpStatus: number | undefined;
      let settled = false;

      const finish = (result: LoadResult): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(result);
      };

      const listener = (
        updatedId: number,
        info: chrome.tabs.OnUpdatedInfo & { httpStatusCode?: number }
      ): void => {
        if (updatedId !== tabId) return;
        if (typeof info.httpStatusCode === 'number') httpStatus = info.httpStatusCode;
        if (info.status === 'complete') finish({ httpStatus });
      };

      const timer = setTimeout(() => finish({ httpStatus, timedOut: true }), LOAD_TIMEOUT_MS);
      chrome.tabs.onUpdated.addListener(listener);
    }),
});

export const createExtractPort = (): ExtractPort => ({
  extract: async (tabId: number, source: string): Promise<ExtractResponse> => {
    for (let attempt = 0; attempt < EXTRACT_ATTEMPTS; attempt += 1) {
      try {
        return (await chrome.tabs.sendMessage(tabId, {
          type: 'extract',
          source,
        })) as ExtractResponse;
      } catch {
        await wait(EXTRACT_RETRY_MS);
      }
    }
    throw new ExtractUnavailable();
  },
});

export const createRunnerApi = (api: ExtensionApi): RunnerApi => ({
  listTasks: (): Promise<ExtensionTaskAssignment[]> => api.listTasks(),
  updateTask: (taskId: string, update: ExtensionTaskUpdate): Promise<unknown> =>
    api.updateTask(taskId, update),
  ingestJobs: (request: IngestJobsRequest): Promise<IngestJobsResponse> => api.ingestJobs(request),
});
