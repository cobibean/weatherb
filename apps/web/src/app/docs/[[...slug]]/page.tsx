import { notFound } from 'next/navigation';
import { DocsLayout } from '@/components/docs';
import { docNav, getDocBySlug } from '@/content/docs';

type DocsPageProps = {
  params: Promise<{ slug?: string[] }>;
};

export const dynamicParams = false;
export const dynamic = 'force-static';

export function generateStaticParams(): { slug: string[] }[] {
  const slugs = docNav
    .map((item) => item.slug)
    .filter((slug) => slug !== 'README')
    .map((slug) => ({ slug: [slug] }));

  return [{ slug: [] }, ...slugs];
}

export default async function DocsCatchAllPage({ params }: DocsPageProps): Promise<React.ReactElement> {
  const { slug: slugSegments } = await params;
  if (slugSegments && slugSegments.length > 1) {
    notFound();
  }

  const slug = slugSegments?.[0] ?? 'README';
  const page = getDocBySlug(slug);
  if (!page) {
    notFound();
  }

  const activeLabel = docNav.find((item) => item.slug === page.slug)?.label;

  return (
    <DocsLayout
      page={page}
      navItems={docNav}
      activeSlug={page.slug}
      activeLabel={activeLabel}
    />
  );
}
