import * as fs from 'node:fs';
import mongoose from 'mongoose';
import { findEnvFile } from '../../../config/env';
import { JobSource, JobSourceSchema, emptyHealth } from '../source.schema';
import { SOURCE_SEED } from './source-seed.data';

/**
 * Upserts the curated source registry into `job_sources`.
 * Run with: npm run seed:sources -w apps/api
 * Existing rows are updated without touching their runtime health.
 */
function loadDotEnv(): void {
  const file = findEnvFile();
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match || match[1].startsWith('#')) continue;
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = raw.replace(/^["']|["']$/g, '');
  }
}

async function main(): Promise<void> {
  loadDotEnv();

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set — add it to your .env');
  }

  await mongoose.connect(uri);
  const model = mongoose.model<InstanceType<typeof JobSource>>(JobSource.name, JobSourceSchema);

  const existing = new Set((await model.find({}, { id: 1 }).lean()).map(row => String(row.id)));

  let created = 0;
  let updated = 0;
  for (const seed of SOURCE_SEED) {
    const result = await model.updateOne(
      { id: seed.id },
      {
        $set: {
          name: seed.name,
          description: seed.description,
          baseUrl: seed.baseUrl,
          type: seed.type,
          countries: seed.countries,
          categories: seed.categories,
          remoteFriendly: seed.remoteFriendly,
          status: seed.status,
          config: seed.config,
          requiresUserToken: seed.requiresUserToken,
          executionMode: seed.executionMode ?? 'server',
          requiresExtension: Boolean(seed.requiresExtension),
          addedBy: seed.addedBy,
        },
        $setOnInsert: { health: emptyHealth(), ownerId: null },
      },
      { upsert: true }
    );
    if (result.upsertedCount) created += 1;
    else if (result.modifiedCount) updated += 1;
  }

  const active = SOURCE_SEED.filter(source => source.status === 'active').length;
  const countries = new Set(SOURCE_SEED.flatMap(source => source.countries)).size;

  console.log(
    `job_sources: ${created} created, ${updated} updated, ` +
      `${SOURCE_SEED.length - created - updated} unchanged ` +
      `(registry had ${existing.size} row(s) before)`
  );
  console.log(
    `${SOURCE_SEED.length} seeded sources — ${active} active, ` +
      `${SOURCE_SEED.length - active} pending/disabled, ${countries} country codes`
  );

  await mongoose.disconnect();
}

main().catch(error => {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
  return mongoose.disconnect().finally(() => process.exit(1));
});
