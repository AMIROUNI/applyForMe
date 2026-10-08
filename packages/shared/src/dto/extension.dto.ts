import { z } from 'zod';
import { extensionTaskStatusSchema } from './scraper.dto';

/** Short-lived code the platform shows so an extension can mint its own token. */
export const extensionPairingChallengeSchema = z.object({
  code: z.string().min(8).max(64),
  expiresAt: z.date().or(z.string()),
});

export const extensionTaskAssignmentSchema = z.object({
  runId: z.string().min(1),
  taskId: z.string().min(1),
  source: z.string().min(1),
  status: extensionTaskStatusSchema,
  searchUrl: z.string().max(1000),
  keywords: z.array(z.string().max(60)),
  countries: z.array(z.string().min(2).max(2)),
  remoteOnly: z.boolean(),
});

export const extensionTaskListSchema = z.object({
  tasks: z.array(extensionTaskAssignmentSchema),
});

export const extensionPairRequestSchema = z.object({
  code: z.string().trim().min(8).max(64),
  label: z.string().trim().min(1).max(60).default('Browser extension'),
});

export const extensionPairResultSchema = z.object({
  token: z.string().min(32).max(200),
  deviceId: z.string().min(1),
});

export const extensionDeviceSchema = z.object({
  id: z.string(),
  label: z.string(),
  lastUsedAt: z.date().or(z.string()).nullable(),
  createdAt: z.date().or(z.string()).nullable(),
  revoked: z.boolean(),
});

export const extensionDeviceListSchema = z.object({
  devices: z.array(extensionDeviceSchema),
});

export type ExtensionPairingChallenge = z.infer<typeof extensionPairingChallengeSchema>;
export type ExtensionTaskAssignment = z.infer<typeof extensionTaskAssignmentSchema>;
export type ExtensionTaskList = z.infer<typeof extensionTaskListSchema>;
export type ExtensionPairRequest = z.infer<typeof extensionPairRequestSchema>;
export type ExtensionPairResult = z.infer<typeof extensionPairResultSchema>;
export type ExtensionDevice = z.infer<typeof extensionDeviceSchema>;
export type ExtensionDeviceList = z.infer<typeof extensionDeviceListSchema>;
