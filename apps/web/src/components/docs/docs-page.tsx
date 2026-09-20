import type { DocPage, DocSection } from '@/content/docs';
import { contractBlock } from '@/content/docs';
import { DocBlockRenderer } from './doc-blocks';

type DocsPageProps = {
  page: DocPage;
};

const shouldShowHeading = (section: DocSection, pageTitle: string): boolean => {
  if (!section.title) return false;
  return section.title !== pageTitle;
};

const withContractBlock = (page: DocPage): DocSection[] => {
  if (page.includeContractBlock === false) return page.sections;
  const hasContract = page.sections.some((section) => section.id === contractBlock.id);
  if (hasContract) return page.sections;
  return [...page.sections, contractBlock];
};

export function DocsPage({ page }: DocsPageProps): React.ReactElement {
  const sections = withContractBlock(page);

  return (
    <article className="space-y-10">
      <header>
        <h1 className="font-display text-3xl sm:text-4xl text-[#f4f7fb]">{page.title}</h1>
      </header>

      {sections.map((section) => (
        <section key={section.id} id={section.id} className="scroll-mt-24 space-y-4">
          {shouldShowHeading(section, page.title) && (
            <h2 className="font-display text-2xl text-[#f4f7fb]">{section.title}</h2>
          )}
          <div className="space-y-5">
            {section.blocks.map((block, index) => (
              <DocBlockRenderer key={`${section.id}-block-${index}`} block={block} />
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
