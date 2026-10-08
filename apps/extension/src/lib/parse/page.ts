import type { IngestJobItem } from '@agency-apply/shared';

export interface PageEl {
  text(selector?: string): string;
  attr(name: string): string | null;
  select(selector: string): PageEl[];
}

export interface PageDoc {
  select(selector: string): PageEl[];
  text(selector: string): string;
}

export interface ParsedPage {
  items: IngestJobItem[];
  nextUrl: string | null;
}

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();

const domEl = (node: Element): PageEl => ({
  text: (selector?: string): string => {
    const target = selector ? node.querySelector(selector) : node;
    return normalize(target?.textContent ?? '');
  },
  attr: (name: string): string | null => node.getAttribute(name),
  select: (selector: string): PageEl[] => Array.from(node.querySelectorAll(selector)).map(domEl),
});

export const createDomPage = (root: ParentNode): PageDoc => ({
  select: (selector: string): PageEl[] => Array.from(root.querySelectorAll(selector)).map(domEl),
  text: (selector: string): string => normalize(root.querySelector(selector)?.textContent ?? ''),
});
