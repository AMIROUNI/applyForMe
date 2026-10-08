import { load } from 'cheerio';
import type { PageDoc, PageEl } from '../lib/parse/page';

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();

export const fromHtml = (html: string): PageDoc => {
  const $ = load(html);
  const wrap = (selection: ReturnType<typeof $>): PageEl => ({
    text: (selector?: string): string => {
      const target = selector ? selection.find(selector).first() : selection.first();
      return normalize(target.text());
    },
    attr: (name: string): string | null => selection.attr(name) ?? null,
    select: (selector: string): PageEl[] =>
      selection
        .find(selector)
        .toArray()
        .map(node => wrap($(node))),
  });
  return {
    select: (selector: string): PageEl[] =>
      $(selector)
        .toArray()
        .map(node => wrap($(node))),
    text: (selector: string): string => normalize($(selector).first().text()),
  };
};
