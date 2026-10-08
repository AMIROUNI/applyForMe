import {
  extensionDeviceListSchema,
  extensionPairResultSchema,
  extensionTaskListSchema,
  ingestJobsRequestSchema,
  ingestJobsResponseSchema,
  scraperRunSchema,
  type ExtensionPairResult,
  type ExtensionTaskAssignment,
  type ExtensionTaskUpdate,
  type IngestJobsRequest,
  type IngestJobsResponse,
  type ScraperRun,
} from '@agency-apply/shared';
import type { ZodType, ZodTypeDef } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const joinUrl = (baseUrl: string, path: string): string =>
  `${baseUrl.replace(/\/+$/, '')}${path}`;

export class ExtensionApi {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string | null
  ) {}

  async pair(code: string, label: string): Promise<ExtensionPairResult> {
    return this.request(
      '/extension/pair',
      { method: 'POST', body: { code, label } },
      extensionPairResultSchema,
      false
    );
  }

  async listTasks(): Promise<ExtensionTaskAssignment[]> {
    const body = await this.request('/extension/tasks', { method: 'GET' }, extensionTaskListSchema);
    return body.tasks;
  }

  async updateTask(taskId: string, update: ExtensionTaskUpdate): Promise<ScraperRun> {
    return this.request(
      `/extension/tasks/${encodeURIComponent(taskId)}`,
      { method: 'PATCH', body: update },
      scraperRunSchema
    );
  }

  async ingestJobs(request: IngestJobsRequest): Promise<IngestJobsResponse> {
    const validated = ingestJobsRequestSchema.parse(request);
    return this.request(
      '/ingest/jobs',
      { method: 'POST', body: validated },
      ingestJobsResponseSchema
    );
  }

  async deleteDevice(deviceId: string): Promise<void> {
    await this.request(
      `/extension/devices/${encodeURIComponent(deviceId)}`,
      { method: 'DELETE' },
      extensionDeviceListSchema
    );
  }

  private async request<T>(
    path: string,
    init: { method: string; body?: unknown },
    schema: ZodType<T, ZodTypeDef, unknown>,
    authenticated = true
  ): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authenticated && this.token) headers.Authorization = `Bearer ${this.token}`;

    let response: Response;
    try {
      response = await fetch(joinUrl(this.baseUrl, path), {
        method: init.method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch {
      throw new ApiError(0, 'NETWORK', 'Could not reach the ApplyForME API');
    }

    if (!response.ok) {
      throw await toApiError(response);
    }

    const text = await response.text();
    if (!text) return undefined as T;
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError(
        response.status,
        'INVALID_RESPONSE',
        'The API returned an unreadable response'
      );
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError(
        response.status,
        'INVALID_RESPONSE',
        'The API returned an unexpected response'
      );
    }
    return parsed.data;
  }
}

const toApiError = async (response: Response): Promise<ApiError> => {
  const fallback = new ApiError(
    response.status,
    `HTTP_${response.status}`,
    response.statusText || 'Request failed'
  );
  try {
    const body = (await response.json()) as {
      statusCode?: number;
      code?: string;
      message?: string;
    };
    if (body && typeof body === 'object') {
      return new ApiError(
        typeof body.statusCode === 'number' ? body.statusCode : response.status,
        typeof body.code === 'string' && body.code ? body.code : fallback.code,
        typeof body.message === 'string' && body.message ? body.message : fallback.message
      );
    }
  } catch {
    return fallback;
  }
  return fallback;
};
