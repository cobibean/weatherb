import type { DocBlock } from '@/content/docs';
import { renderInlineMarkdown, renderMarkdownParagraphs } from './markdown';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type DocBlockRendererProps = {
  block: DocBlock;
};

export function DocBlockRenderer({ block }: DocBlockRendererProps) {
  switch (block.type) {
    case 'prose':
      return (
        <div className="space-y-4">{renderMarkdownParagraphs(block.markdown)}</div>
      );
    case 'list': {
      const ListTag = block.ordered ? 'ol' : 'ul';
      return (
        <ListTag
          className={`space-y-2 pl-6 text-base text-neutral-700 ${
            block.ordered ? 'list-decimal' : 'list-disc'
          }`}
        >
          {block.items.map((item, index) => (
            <li key={`list-item-${index}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ListTag>
      );
    }
    case 'table':
      return (
        <div className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-cloud-soft/60">
                {block.headers.map((header) => (
                  <TableHead
                    key={header}
                    className="text-sm font-semibold text-neutral-700"
                  >
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {block.rows.map((row, rowIndex) => (
                <TableRow key={`table-row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={`table-cell-${rowIndex}-${cellIndex}`} className="align-top">
                      {renderInlineMarkdown(cell)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    case 'callout':
      return (
        <div className="rounded-2xl border border-sky-medium/20 bg-sky-light/10 p-4">
          {block.title && (
            <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-sky-deep">
              {block.title}
            </div>
          )}
          <div className="space-y-3">{renderMarkdownParagraphs(block.markdown)}</div>
        </div>
      );
    default:
      return null;
  }
}
