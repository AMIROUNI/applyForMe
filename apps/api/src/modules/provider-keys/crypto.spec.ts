import { decryptSecret, encryptSecret } from './crypto';

const KEY = Buffer.alloc(32, 7).toString('base64');
const PASSPHRASE = 'a-very-long-passphrase-that-is-over-32-chars';

describe('provider key crypto', () => {
  it('round-trips a secret', () => {
    const token = 'apify_api_abc123DEF-xyz';
    expect(decryptSecret(encryptSecret(token, KEY), KEY)).toBe(token);
  });

  it('handles unicode and empty-ish values', () => {
    for (const value of ['jeton-éèê-🔑', 'x'.repeat(300)]) {
      expect(decryptSecret(encryptSecret(value, KEY), KEY)).toBe(value);
    }
  });

  it('never stores the plaintext and uses a fresh IV per call', () => {
    const token = 'apify_api_same-token-every-time';
    const first = encryptSecret(token, KEY);
    const second = encryptSecret(token, KEY);
    expect(first).not.toContain(token);
    expect(first).not.toBe(second);
    expect(first.split(':')).toHaveLength(4);
    expect(first.startsWith('v1:')).toBe(true);
  });

  it('rejects tampering with the ciphertext', () => {
    const payload = encryptSecret('secret-value', KEY);
    const [version, iv, tag, data] = payload.split(':');
    const bytes = Buffer.from(data, 'base64');
    bytes[0] ^= 0xff;
    const tampered = [version, iv, tag, bytes.toString('base64')].join(':');
    expect(() => decryptSecret(tampered, KEY)).toThrow();
  });

  it('rejects the wrong key', () => {
    const payload = encryptSecret('secret-value', KEY);
    const otherKey = Buffer.alloc(32, 9).toString('base64');
    expect(() => decryptSecret(payload, otherKey)).toThrow();
  });

  it('rejects malformed payloads', () => {
    expect(() => decryptSecret('not-encrypted', KEY)).toThrow('Malformed encrypted secret');
    expect(() => decryptSecret('v2:a:b:c', KEY)).toThrow('Malformed encrypted secret');
    expect(() => decryptSecret('v1:a:b', KEY)).toThrow('Malformed encrypted secret');
  });

  it('accepts non-base64 ENCRYPTION_KEY material via hashing', () => {
    const payload = encryptSecret('secret-value', PASSPHRASE);
    expect(decryptSecret(payload, PASSPHRASE)).toBe('secret-value');
  });
});
