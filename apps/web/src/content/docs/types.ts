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
        'Network: Arc Testnet (5042002). Use the configured deployment address.',
        `Explorer: https://explorer.testnet.arc.io${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ? `/address/${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}` : ''}`,
      ],
    },
  ],
};
