import { detectBlocked } from '../lib/blocked';

describe('detectBlocked', () => {
  it('treats HTTP 403 and 429 as blocked', () => {
    expect(detectBlocked({ url: 'https://www.linkedin.com/jobs/search', httpStatus: 403 })).toEqual(
      {
        code: 'http',
        message: 'The site refused the request (HTTP 403)',
      }
    );
    expect(detectBlocked({ url: 'https://www.indeed.com/jobs', httpStatus: 429 })).toEqual({
      code: 'http',
      message: 'The site is rate limiting us (HTTP 429)',
    });
  });

  it('detects login walls in the final URL', () => {
    expect(
      detectBlocked({ url: 'https://www.linkedin.com/checkpoint/lg/login-submit' })?.code
    ).toBe('login');
    expect(detectBlocked({ url: 'https://www.linkedin.com/authwall?trk=xyz' })?.code).toBe('login');
    expect(detectBlocked({ url: 'https://secure.indeed.com/signin?co=US' })?.code).toBe('login');
    expect(detectBlocked({ url: 'https://accounts.google.com/ServiceLogin?x=1' })?.code).toBe(
      'login'
    );
  });

  it('detects CAPTCHA pages from their text', () => {
    const text = 'Our systems have detected unusual traffic from your computer network.';
    expect(detectBlocked({ url: 'https://www.google.com/recaptcha', text })?.code).toBe('captcha');
    expect(
      detectBlocked({
        url: 'https://www.indeed.com/jobs',
        text: 'Please complete the captcha to continue',
      })?.code
    ).toBe('captcha');
    expect(
      detectBlocked({
        url: 'https://www.linkedin.com/jobs/search',
        text: 'Please sign in to continue',
      })?.code
    ).toBe('login');
  });

  it('leaves ordinary result pages alone', () => {
    expect(
      detectBlocked({
        url: 'https://www.indeed.com/jobs?q=developer',
        httpStatus: 200,
        text: '1,204 open jobs for developer. Sign in to save jobs — no wait, plain results text.',
      })
    ).toBeNull();
    expect(
      detectBlocked({ url: 'https://www.linkedin.com/jobs/search', httpStatus: 200 })
    ).toBeNull();
  });

  it('does not classify server errors as blocked', () => {
    expect(detectBlocked({ url: 'https://www.indeed.com/jobs', httpStatus: 503 })).toBeNull();
  });
});
