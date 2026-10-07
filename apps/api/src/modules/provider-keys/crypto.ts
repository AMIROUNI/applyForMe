import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const VERSION = 'v1';

/**
 * 32-byte key from the env material: a base64 value that decodes to 32 bytes
 * is used as-is, anything else (a passphrase) is hashed so every >=32 char
 * ENCRYPTION_KEY the schema accepts works deterministically.
 */
function keyFrom(material: string): Buffer {
  const decoded = Buffer.from(material, 'base64');
  if (decoded.length === 32) return decoded;
  return createHash('sha256').update(material, 'utf8').digest();
}

/** AES-256-GCM -> `v1:<iv>:<tag>:<ciphertext>` (base64 parts, 12-byte IV). */
export function encryptSecret(plain: string, keyMaterial: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(keyMaterial), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

export function decryptSecret(payload: string, keyMaterial: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Malformed encrypted secret');
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(
    'aes-256-gcm',
    keyFrom(keyMaterial),
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
