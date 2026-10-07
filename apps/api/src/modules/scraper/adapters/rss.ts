import { load } from 'cheerio';

export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  region: string;
  category: string;
}

/**
 * RSS 2.0 / Atom item extraction shared by the bespoke and generic feed
 * adapters. `link` is read from `<link href>` (Atom) or element text (RSS).
 */
export function parseRss(xml: string): RssItem[] {
  const $ = load(xml, { xmlMode: true });
  return $('item, entry')
    .toArray()
    .map(element => {
      const item = $(element);
      const link = item.find('link').first();
      return {
        title: item.find('title').first().text().trim(),
        link: (link.attr('href') ?? link.text()).trim(),
        description: item.find('description, summary').first().text().trim(),
        pubDate: item.find('pubDate, published, updated').first().text().trim(),
        region: item.find('region').first().text().trim(),
        category: item.find('category').first().text().trim(),
      };
    });
}
