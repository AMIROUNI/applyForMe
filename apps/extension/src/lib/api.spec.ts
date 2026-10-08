import { ApiError, ExtensionApi, joinUrl } from '../lib/api';

const jsonResponse = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: async () => JSON.stringify(body),
    json: async () => body,
  }) as unknown as Response;

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('joinUrl', () => {
  it('joins without duplicating slashes', () => {
    expect(joinUrl('http://localhost:3000/api/v1', '/extension/tasks')).toBe(
      'http://localhost:3000/api/v1/extension/tasks'
    );
    expect(joinUrl('http://localhost:3000/api/v1/', '/extension/tasks')).toBe(
      'http://localhost:3000/api/v1/extension/tasks'
    );
  });
});

describe('ExtensionApi', () => {
  it('pairs without an authorization header', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ token: 't'.repeat(40), deviceId: 'dev-1' }));
    const api = new ExtensionApi('http://localhost:3000/api/v1', null);

    const result = await api.pair('K7M2QX9P', 'Browser extension');

    expect(result).toEqual({ token: 't'.repeat(40), deviceId: 'dev-1' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/api/v1/extension/pair');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(JSON.parse(String(init.body))).toEqual({ code: 'K7M2QX9P', label: 'Browser extension' });
  });

  it('sends the bearer token when listing tasks', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ tasks: [] }));
    const api = new ExtensionApi('http://base.test/v1', 'secret-token');

    const tasks = await api.listTasks();

    expect(tasks).toEqual([]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://base.test/v1/extension/tasks');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-token');
  });

  it('rejects an unexpected response shape', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ tasks: 'not-an-array' }));
    const api = new ExtensionApi('http://base.test/v1', 'tok');

    await expect(api.listTasks()).rejects.toMatchObject({
      name: 'ApiError',
      status: 200,
      code: 'INVALID_RESPONSE',
    });
  });

  it('maps API error bodies onto ApiError', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { statusCode: 409, code: 'TASK_STATE_INVALID', message: 'A done task cannot be running' },
        409
      )
    );
    const api = new ExtensionApi('http://base.test/v1', 'tok');

    await expect(api.updateTask('task-9', { status: 'running' })).rejects.toMatchObject({
      status: 409,
      code: 'TASK_STATE_INVALID',
      message: 'A done task cannot be running',
    });
  });

  it('turns network failures into a NETWORK ApiError', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const api = new ExtensionApi('http://base.test/v1', 'tok');

    await expect(api.listTasks()).rejects.toMatchObject({ status: 0, code: 'NETWORK' });
  });

  it('validates the ingest payload before calling fetch', async () => {
    const api = new ExtensionApi('http://base.test/v1', 'tok');

    await expect(api.ingestJobs({ taskId: 'task-1', items: [] })).rejects.toBeInstanceOf(Error);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the validated ingest payload', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ingested: 1, found: 1, taskStatus: 'running' }));
    const api = new ExtensionApi('http://base.test/v1', 'tok');

    const response = await api.ingestJobs({
      runId: 'run-1',
      taskId: 'task-1',
      items: [
        {
          title: 'Dev',
          company: 'Co',
          location: 'Paris',
          url: 'https://www.indeed.com/viewjob?jk=1',
          description: '',
          skills: [],
        },
      ],
    });

    expect(response).toEqual({ ingested: 1, found: 1, taskStatus: 'running' });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.runId).toBe('run-1');
    expect(body.taskId).toBe('task-1');
    expect(body.items).toHaveLength(1);
  });

  it('throws for unexpected error bodies too', async () => {
    fetchMock.mockResolvedValue(jsonResponse('oops', 500));
    const api = new ExtensionApi('http://base.test/v1', 'tok');

    await expect(api.listTasks()).rejects.toBeInstanceOf(ApiError);
    await expect(api.listTasks()).rejects.toMatchObject({ status: 500 });
  });
});
