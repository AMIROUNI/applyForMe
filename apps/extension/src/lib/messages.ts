import type { IngestJobItem } from '@agency-apply/shared';

export interface ExtractRequest {
  type: 'extract';
  source: string;
}

export type ExtractResponse =
  | { kind: 'items'; items: IngestJobItem[]; nextUrl: string | null }
  | { kind: 'blocked'; message: string }
  | { kind: 'error'; message: string };

export class ExtractUnavailable extends Error {
  constructor(message = 'Could not read the page') {
    super(message);
    this.name = 'ExtractUnavailable';
  }
}
