import type { DocPage } from '@/content/docs';
import { Header, Footer } from '@/components/layout';
import { DocsNav } from './docs-nav';
import { DocsPage } from './docs-page';

type DocsLayoutProps = {
  page: DocPage;
  navItems: { slug: string; label: string }[];
  activeSlug: string;
  activeLabel?: string | undefined;
};

export function DocsLayout({ page, navItems, activeSlug, activeLabel }: DocsLayoutProps): React.ReactElement {
  return (
    <div data-wb-theme="afterglow" className="wb-home wb-docs min-h-screen flex flex-col">
      <Header afterglow />
      <main className="wb-interior-main flex-1">
        <div className="wb-shell">
          <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside>
              <DocsNav items={navItems} activeSlug={activeSlug} {...(activeLabel && { activeLabel })} />
            </aside>
            <div className="min-w-0 rounded-2xl border border-[#30475a] bg-[#0c2134] p-6 shadow-xs backdrop-blur-lg sm:p-8">
              <DocsPage page={page} />
            </div>
          </div>
        </div>
      </main>
      <Footer afterglow />
    </div>
  );
}
