export interface BlockedSignal {
  url: string;
  httpStatus?: number;
  text?: string;
}

export interface BlockedReason {
  code: 'login' | 'captcha' | 'http';
  message: string;
}

const LOGIN_PATTERNS: RegExp[] = [
  /\/login\b/i,
  /\/signin\b/i,
  /authwall/i,
  /\/checkpoint\//i,
  /\/uas\/login/i,
  /accounts\.google\.com/i,
  /\/captcha\b/i,
  /\/challenge\//i,
];

const TEXT_PATTERNS: Array<{ pattern: RegExp; code: BlockedReason['code']; message: string }> = [
  {
    pattern: /unusual traffic/i,
    code: 'captcha',
    message: 'CAPTCHA challenge: unusual traffic page',
  },
  {
    pattern: /verify you are (a )?human/i,
    code: 'captcha',
    message: 'CAPTCHA challenge: human verification page',
  },
  { pattern: /complete the captcha/i, code: 'captcha', message: 'CAPTCHA challenge on the page' },
  { pattern: /are you a robot/i, code: 'captcha', message: 'CAPTCHA challenge: robot check page' },
  {
    pattern: /sign in to continue/i,
    code: 'login',
    message: 'Login wall: the site asks you to sign in',
  },
  { pattern: /403 forbidden/i, code: 'http', message: 'The site refused the request (HTTP 403)' },
  {
    pattern: /too many requests/i,
    code: 'http',
    message: 'The site is rate limiting us (HTTP 429)',
  },
];

export const detectBlocked = (signal: BlockedSignal): BlockedReason | null => {
  if (signal.httpStatus === 403) {
    return { code: 'http', message: 'The site refused the request (HTTP 403)' };
  }
  if (signal.httpStatus === 429) {
    return { code: 'http', message: 'The site is rate limiting us (HTTP 429)' };
  }
  for (const pattern of LOGIN_PATTERNS) {
    if (pattern.test(signal.url)) {
      const host = safeHost(signal.url);
      return { code: 'login', message: `Login wall at ${host}` };
    }
  }
  const text = signal.text ?? '';
  if (text) {
    for (const entry of TEXT_PATTERNS) {
      if (entry.pattern.test(text)) return { code: entry.code, message: entry.message };
    }
  }
  return null;
};

const safeHost = (value: string): string => {
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
};
