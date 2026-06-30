export type DocBlock =
  | { type: 'prose'; markdown: string }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'callout'; title?: string; markdown: string };

export type DocSection = {
  id: string;
  title: string;
  blocks: DocBlock[];
};

export type DocPage = {
  slug: string;
  title: string;
  sections: DocSection[];
  includeContractBlock?: boolean;
};

export const contractBlock: DocSection = {
  id: 'contract-explorer',
  title: 'Contract and Explorer',
  blocks: [
    {
      type: 'list',
      items: [
        'App: https://weatherb.app',
        'Contract (Coston2): 0x716186B29043840a165e1Faf49b85bc2101fAaC7',
        'Explorer: https://coston2-explorer.flare.network/address/0x716186B29043840a165e1Faf49b85bc2101fAaC7',
      ],
    },
  ],
};
