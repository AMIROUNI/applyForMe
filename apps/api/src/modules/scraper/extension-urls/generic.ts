import type { ExtensionSearchContext } from './linkedin';

export const buildCurrentPageSearchUrl = (ctx: ExtensionSearchContext): string => ctx.baseUrl;
