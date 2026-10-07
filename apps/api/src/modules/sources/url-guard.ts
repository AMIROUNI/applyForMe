import { BadRequestException } from '@nestjs/common';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  '0.0.0.0',
  '::1',
  '::',
  'ip6-localhost',
  'ip6-loopback',
]);

const PRIVATE_HOST_PATTERNS = [
  /\.local$/i,
  /\.internal$/i,
  /\.localhost$/i,
  /\.test$/i,
  /\.example$/i,
];

const PRIVATE_IPV4 = [
  /^127\./,
  /^10\./,
  /^0\./,
  /^169\.254\./,
  /^192\.168\./,
  /^198\.18\./,
  /^198\.19\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
];

const isPrivateIpv4 = (host: string): boolean => PRIVATE_IPV4.some(pattern => pattern.test(host));

/**
 * SSRF guard for user-supplied URLs: http(s) only, no localhost/private ranges.
 * Phase 8 hardens this with DNS resolution and redirect limits.
 */
export function assertSafeHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException({
      statusCode: 400,
      code: 'INVALID_URL',
      message: 'Invalid URL',
      details: [{ path: 'baseUrl', message: 'Must be a valid absolute URL' }],
    });
  }

  const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const blocked =
    !isHttp ||
    BLOCKED_HOSTNAMES.has(hostname.toLowerCase()) ||
    PRIVATE_HOST_PATTERNS.some(pattern => pattern.test(hostname)) ||
    isPrivateIpv4(hostname);

  if (blocked) {
    throw new BadRequestException({
      statusCode: 400,
      code: 'UNSAFE_URL',
      message: 'This URL is not allowed',
      details: [
        {
          path: 'baseUrl',
          message: 'Only public http(s) addresses can be added as a source',
        },
      ],
    });
  }

  return url;
}

export function isSafeHttpUrl(raw: string): boolean {
  try {
    assertSafeHttpUrl(raw);
    return true;
  } catch {
    return false;
  }
}
