import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { LlmService } from './llm.service';

const makeConfig = (values: Record<string, string | undefined>) =>
  ({ get: jest.fn((key: string) => values[key]) }) as never;

const envelope = (content: unknown) => ({
  ok: true,
  status: 200,
  text: async () =>
    JSON.stringify({
      choices: [
        { message: { content: typeof content === 'string' ? content : JSON.stringify(content) } },
      ],
    }),
});

const validProposal = {
  name: 'Open Jobs API',
  baseUrl: 'https://jobs.example.org',
  type: 'api',
  endpoint: 'https://jobs.example.org/api/list?contract=cdi',
  why: 'Public JSON endpoint',
};

describe('LlmService', () => {
  let fetchMock: jest.Mock;
  const originalFetch = global.fetch;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as never;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const service = (values: Record<string, string | undefined>): LlmService =>
    new LlmService(
      makeConfig({
        GROQ_API_KEY: 'test-key',
        GROQ_BASE_URL: 'https://groq.test/v1',
        GROQ_MODEL: 'test-model',
        ...values,
      })
    );

  it('returns only proposals that pass the shared schema', async () => {
    fetchMock.mockResolvedValue(
      envelope({
        sources: [
          validProposal,
          { name: 'Bad', baseUrl: 'https://ok.example.org', type: 'ai_extract' },
          { name: 'Bad', baseUrl: 'ftp://files.example.org', type: 'html' },
          { name: 'Board A', baseUrl: 'https://a.example.org', type: 'html' },
          { name: 'Board B', baseUrl: 'https://b.example.org', type: 'html' },
          { name: 'Board C', baseUrl: 'https://c.example.org', type: 'html' },
          { name: 'Board D', baseUrl: 'https://d.example.org', type: 'html' },
          { name: 'Board E', baseUrl: 'https://e.example.org', type: 'html' },
        ],
      })
    );

    const proposals = await service({}).proposeSources('fr', ['dev']);

    expect(proposals).toHaveLength(6);
    expect(proposals[0]).toMatchObject({ name: 'Open Jobs API', type: 'api' });
    expect(proposals.some(proposal => proposal.type === 'ai_extract')).toBe(false);
  });

  it('sends the key in the Authorization header, never in the URL', async () => {
    fetchMock.mockResolvedValue(envelope({ sources: [validProposal] }));

    await service({ GROQ_MODEL: 'custom-model' }).proposeSources('tn', []);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://groq.test/v1/chat/completions');
    expect(url).not.toContain('test-key');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-key');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.model).toBe('custom-model');
    expect(body.response_format).toEqual({ type: 'json_object' });
    const messages = body.messages as Array<{ content: string }>;
    expect(messages[1]?.content).toContain('TN');
  });

  it('refuses to run without a GROQ_API_KEY', async () => {
    await expect(service({ GROQ_API_KEY: undefined }).proposeSources('fr', [])).rejects.toThrow(
      ServiceUnavailableException
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps request failures to a 502', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));

    const error = await service({})
      .proposeSources('fr', [])
      .catch(caught => caught);
    expect(error).toBeInstanceOf(BadGatewayException);
    expect(error).toMatchObject({
      response: expect.objectContaining({ code: 'AI_DISCOVERY_FAILED' }),
    });
  });

  it('maps unreadable completions to a 502', async () => {
    // Body parse happens inside fetchJson - still a 502, just the transport code.
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => 'not json' });

    const first = await service({})
      .proposeSources('fr', [])
      .catch(caught => caught);
    expect(first).toBeInstanceOf(BadGatewayException);
    expect(first).toMatchObject({
      response: expect.objectContaining({ code: 'AI_DISCOVERY_FAILED' }),
    });

    // Well-formed transport, wrong completion shape -> the output-specific code.
    fetchMock.mockResolvedValue(envelope({ unexpected: [] }));
    const second = await service({})
      .proposeSources('fr', [])
      .catch(caught => caught);
    expect(second).toMatchObject({
      response: expect.objectContaining({ code: 'AI_DISCOVERY_BAD_OUTPUT' }),
    });

    fetchMock.mockResolvedValue(envelope('still not json'));
    const third = await service({})
      .proposeSources('fr', [])
      .catch(caught => caught);
    expect(third).toMatchObject({
      response: expect.objectContaining({ code: 'AI_DISCOVERY_BAD_OUTPUT' }),
    });
  });
});
