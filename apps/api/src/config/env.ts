import * as fs from 'fs';
import * as path from 'path';
import type { EnvConfig } from './configuration';
import { validateEnv } from './configuration';

export type { EnvConfig } from './configuration';

export function findEnvFile(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '.env';
}

export default function loadEnv(): EnvConfig {
  return validateEnv(process.env as Record<string, unknown>);
}
