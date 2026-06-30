import type { DocPage } from './types';
import { contractBlock } from './types';
import { docPages, docNav } from './pages';

export { docPages, docNav, contractBlock };
export type { DocBlock, DocSection, DocPage } from './types';

export function getDocBySlug(slug: string): DocPage | undefined {
  return docPages.find((page) => page.slug === slug);
}

export function getDocHref(slug: string): string {
  if (slug === 'README') {
    return '/docs';
  }
  return `/docs/${slug}`;
}
