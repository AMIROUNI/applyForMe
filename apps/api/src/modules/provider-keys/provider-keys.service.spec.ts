import { BadRequestException } from '@nestjs/common';
import { ProviderKeysService } from './provider-keys.service';

const KEY = Buffer.alloc(32, 3).toString('base64');

type Row = {
  userId: string;
  provider: string;
  encryptedKey: string;
  lastFour: string | null;
  lastVerifiedAt: Date | null;
};

const matches = (row: Row, filter: Record<string, unknown>): boolean =>
  Object.entries(filter).every(([key, value]) => row[key as keyof Row] === value);

const makeModel = () => {
  const rows: Row[] = [];
  return {
    rows,
    find: jest.fn((filter: Record<string, unknown>) => ({
      exec: async () => rows.filter(row => matches(row, filter)),
    })),
    findOne: jest.fn((filter: Record<string, unknown>) => ({
      exec: async () => rows.find(row => matches(row, filter)) ?? null,
    })),
    findOneAndUpdate: jest.fn(
      (filter: Record<string, unknown>, update: { $set?: Record<string, unknown> }) => ({
        exec: async () => {
          const existing = rows.find(row => matches(row, filter));
          if (existing) {
            Object.assign(existing, update.$set);
            return existing;
          }
          const created = {
            userId: String(filter['userId']),
            provider: String(filter['provider']),
            encryptedKey: '',
            lastFour: null,
            lastVerifiedAt: null,
            ...(update.$set ?? {}),
          };
          rows.push(created as Row);
          return created;
        },
      })
    ),
    deleteOne: jest.fn((filter: Record<string, unknown>) => ({
      exec: async () => {
        const index = rows.findIndex(row => matches(row, filter));
        if (index >= 0) rows.splice(index, 1);
        return { deletedCount: index >= 0 ? 1 : 0 };
      },
    })),
  };
};

describe('ProviderKeysService', () => {
  let model: ReturnType<typeof makeModel>;
  let service: ProviderKeysService;
  const config = { get: jest.fn().mockReturnValue(KEY) };
  const originalFetch = global.fetch;

  beforeEach(() => {
    model = makeModel();
    service = new ProviderKeysService(model as never, config as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('stores the token encrypted and returns it only through getDecrypted', async () => {
    const token = 'apify_api_SECRET-TOKEN-9876';
    const info = await service.set('user-1', 'apify', token);

    expect(info).toMatchObject({ provider: 'apify', connected: true, lastFour: '9876' });
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0].encryptedKey).not.toContain('SECRET-TOKEN');
    expect(model.rows[0].encryptedKey.startsWith('v1:')).toBe(true);

    await expect(service.getDecrypted('user-1', 'apify')).resolves.toBe(token);
    await expect(service.getDecrypted('user-2', 'apify')).resolves.toBeNull();
  });

  it('lists masked connection state without the raw token', async () => {
    await expect(service.list('user-1')).resolves.toEqual([
      { provider: 'apify', connected: false, lastFour: null, lastVerifiedAt: null },
    ]);

    await service.set('user-1', 'apify', 'apify_api_SECRET-1234');
    const [info] = await service.list('user-1');
    expect(info).toMatchObject({ connected: true, lastFour: '1234' });
    expect(JSON.stringify(info)).not.toContain('SECRET');
  });

  it('upserts on reconnect instead of duplicating rows', async () => {
    await service.set('user-1', 'apify', 'apify_api_FIRST-0001');
    await service.set('user-1', 'apify', 'apify_api_SECOND-0002');
    expect(model.rows).toHaveLength(1);
    await expect(service.getDecrypted('user-1', 'apify')).resolves.toBe('apify_api_SECOND-0002');
  });

  it('removes a stored token', async () => {
    await service.set('user-1', 'apify', 'apify_api_SECRET-9876');
    await expect(service.remove('user-1', 'apify')).resolves.toBe(true);
    await expect(service.getDecrypted('user-1', 'apify')).resolves.toBeNull();
    await expect(service.remove('user-1', 'apify')).resolves.toBe(false);
  });

  describe('verify', () => {
    it('accepts a token Apify confirms and never puts it in the URL', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: { username: 'someone' } }),
      });
      global.fetch = fetchMock as never;

      await expect(service.verify('apify', 'apify_api_GOOD')).resolves.toBeUndefined();

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.apify.com/v2/users/me');
      expect(url).not.toContain('apify_api_GOOD');
      expect((init.headers as Record<string, string>)['Authorization']).toBe(
        'Bearer apify_api_GOOD'
      );
    });

    it('rejects a token Apify refuses', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => '',
      }) as never;

      await expect(service.verify('apify', 'apify_api_BAD')).rejects.toThrow(BadRequestException);
    });

    it('rejects network failures with a 400 the UI can show', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ETIMEDOUT')) as never;
      await expect(service.verify('apify', 'apify_api_ANY')).rejects.toThrow(BadRequestException);
    });
  });
});
