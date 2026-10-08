import { DEFAULT_API_BASE } from './limits';

export interface StoredSettings {
  apiBase: string;
  token: string | null;
  deviceId: string | null;
  knownHosts: string[];
}

type StorageArea = Pick<chrome.storage.StorageArea, 'get' | 'set'>;

const DEFAULTS: StoredSettings = {
  apiBase: DEFAULT_API_BASE,
  token: null,
  deviceId: null,
  knownHosts: [],
};

export const loadSettings = async (
  area: StorageArea = chrome.storage.local
): Promise<StoredSettings> => {
  const stored = (await area.get(null)) as Partial<StoredSettings>;
  return {
    apiBase:
      typeof stored.apiBase === 'string' && stored.apiBase ? stored.apiBase : DEFAULTS.apiBase,
    token: typeof stored.token === 'string' && stored.token ? stored.token : null,
    deviceId: typeof stored.deviceId === 'string' && stored.deviceId ? stored.deviceId : null,
    knownHosts: Array.isArray(stored.knownHosts)
      ? stored.knownHosts.filter((host): host is string => typeof host === 'string')
      : [],
  };
};

export const saveSettings = async (
  patch: Partial<StoredSettings>,
  area: StorageArea = chrome.storage.local
): Promise<void> => {
  await area.set(patch);
};

export const clearPairing = async (area: StorageArea = chrome.storage.local): Promise<void> => {
  await area.set({ token: null, deviceId: null });
};

export const rememberHost = async (
  host: string,
  area: StorageArea = chrome.storage.local
): Promise<void> => {
  const settings = await loadSettings(area);
  if (settings.knownHosts.includes(host)) return;
  await area.set({ knownHosts: [...settings.knownHosts, host] });
};
