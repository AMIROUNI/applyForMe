import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExtensionService } from './extension.service';

type Row = Record<string, unknown> & { save?: jest.Mock };

const matches = (row: Row, filter: Record<string, unknown>): boolean =>
  Object.entries(filter).every(([key, value]) => row[key] === value);

const makeModel = () => {
  const rows: Row[] = [];
  return {
    rows,
    create: jest.fn(async (data: Row) => {
      const doc: Row = {
        ...data,
        _id: `id-${rows.length + 1}`,
        createdAt: new Date(),
        save: jest.fn().mockResolvedValue(undefined),
      };
      rows.push(doc);
      return doc;
    }),
    findOne: jest.fn((filter: Record<string, unknown>) => ({
      exec: jest.fn().mockResolvedValue(rows.find(row => matches(row, filter)) ?? null),
    })),
    find: jest.fn((filter: Record<string, unknown> = {}) => ({
      sort: () => ({
        exec: jest.fn().mockResolvedValue(rows.filter(row => matches(row, filter))),
      }),
    })),
  };
};

describe('ExtensionService', () => {
  let tokenModel: ReturnType<typeof makeModel>;
  let codeModel: ReturnType<typeof makeModel>;
  let service: ExtensionService;

  beforeEach(() => {
    tokenModel = makeModel();
    codeModel = makeModel();
    service = new ExtensionService(tokenModel as never, codeModel as never);
  });

  it('pairs a one-time code with a long-lived token', async () => {
    const challenge = await service.createPairingChallenge('user-1');
    expect(challenge.code).toHaveLength(8);
    expect(new Date(challenge.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(codeModel.rows).toHaveLength(1);

    const result = await service.exchangeCode({ code: challenge.code, label: 'Chrome' });
    expect(result.token).toHaveLength(64);
    expect(result.deviceId).toBeTruthy();
    expect(tokenModel.rows).toHaveLength(1);
    expect(tokenModel.rows[0]).toMatchObject({
      userId: 'user-1',
      label: 'Chrome',
      revokedAt: null,
    });

    const auth = await service.authenticate(result.token);
    expect(auth?.userId).toBe('user-1');

    await expect(service.exchangeCode({ code: challenge.code, label: 'Chrome' })).rejects.toThrow(
      BadRequestException
    );
  });

  it('accepts the pairing code however it is typed', async () => {
    const challenge = await service.createPairingChallenge('user-1');
    const typed = `  ${challenge.code.toLowerCase()} `;
    await expect(service.exchangeCode({ code: typed, label: 'Firefox' })).resolves.toMatchObject({
      deviceId: expect.any(String),
    });
  });

  it('refuses expired, unknown and malformed pairing codes', async () => {
    const expired = await service.createPairingChallenge('user-1');
    (codeModel.rows[0].expiresAt as Date).setTime(Date.now() - 1000);
    await expect(service.exchangeCode({ code: expired.code, label: 'X' })).rejects.toThrow(
      BadRequestException
    );

    await expect(service.exchangeCode({ code: 'ZZZZZZZZ', label: 'X' })).rejects.toThrow(
      BadRequestException
    );
    await expect(service.exchangeCode({ code: 'short', label: 'X' })).rejects.toThrow();
  });

  it('does not authenticate unknown or revoked tokens', async () => {
    expect(await service.authenticate('not-a-token')).toBeNull();

    const challenge = await service.createPairingChallenge('user-1');
    const { token, deviceId } = await service.exchangeCode({
      code: challenge.code,
      label: 'Chrome',
    });

    const devices = await service.listDevices('user-1');
    expect(devices.devices).toEqual([
      expect.objectContaining({ id: 'id-1', label: 'Chrome', revoked: false }),
    ]);

    await service.revokeDevice('user-1', 'id-1');
    expect(await service.authenticate(token)).toBeNull();
    expect((await service.listDevices('user-1')).devices[0].revoked).toBe(true);
    expect(tokenModel.rows[0]).toMatchObject({ deviceId });
  });

  it('keeps devices away from other users', async () => {
    const challenge = await service.createPairingChallenge('user-1');
    const { deviceId } = await service.exchangeCode({ code: challenge.code, label: 'Chrome' });

    expect((await service.listDevices('user-2')).devices).toEqual([]);
    await expect(service.revokeDevice('user-2', deviceId)).rejects.toThrow(NotFoundException);
    await expect(service.revokeDevice('user-1', 'nope')).rejects.toThrow(NotFoundException);
  });
});
