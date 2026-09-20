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

export function DocBlockRenderer({ block }: DocBlockRendererProps): React.ReactElement | null {
  switch (block.type) {
    case 'prose':
      return (
        <div className="space-y-4">{renderMarkdownParagraphs(block.markdown)}</div>
      );
    case 'list': {
      const ListTag = block.ordered ? 'ol' : 'ul';
      return (
        <ListTag
          className={`space-y-2 pl-6 text-base text-[#f4f7fb] ${
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
        <div className="overflow-hidden rounded-2xl border border-[#30475a] bg-[#0c2134] shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#0c2134]">
                {block.headers.map((header) => (
                  <TableHead
                    key={header}
                    className="text-sm font-semibold text-[#f4f7fb]"
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
            <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#a6d6f2]">
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
