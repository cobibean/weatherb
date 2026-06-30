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

export function DocsLayout({ page, navItems, activeSlug, activeLabel }: DocsLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-24 pb-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
            <aside>
              <DocsNav items={navItems} activeSlug={activeSlug} {...(activeLabel && { activeLabel })} />
            </aside>
            <div className="rounded-3xl border border-neutral-200/70 bg-white/70 p-6 shadow-sm backdrop-blur-lg sm:p-8">
              <DocsPage page={page} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
