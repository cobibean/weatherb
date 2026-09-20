import type { DocPage } from './types';
import { contractBlock } from './types';

export const docNav = [
  { slug: 'README', label: 'Overview' },
  { slug: 'getting-started', label: 'Getting Started' },
  { slug: 'markets-101', label: 'Markets 101' },
  { slug: 'betting-and-odds', label: 'Betting and Odds' },
  { slug: 'settlement-and-data', label: 'Settlement and Data Sources' },
  { slug: 'using-the-app', label: 'Using the App' },
  { slug: 'refunds-and-cancellations', label: 'Refunds and Cancellations' },
  { slug: 'security-and-governance', label: 'Security and Governance' },
  { slug: 'faq', label: 'FAQ' },
  { slug: 'glossary', label: 'Glossary' },
  { slug: 'status-and-roadmap', label: 'Status and Roadmap' },
  { slug: 'community', label: 'Community' },
];

export const docPages: DocPage[] = [
  {
    slug: 'README',
    title: 'weatherB Docs',
    includeContractBlock: false,
    sections: [
      {
        id: 'weatherb-docs',
        title: 'weatherB Docs',
        blocks: [
          {
            type: 'prose',
            markdown:
              'weatherB is a simple prediction market on Arc where you bet YES/NO on a temperature outcome:\n"Will the temperature be >= 72F in New York City at 2:00pm?"\n\nThis documentation covers the current testnet release on Arc Testnet. Mainnet documentation will be added when live.',
          },
        ],
      },
      {
        id: 'what-you-can-do-here',
        title: 'What you can do here',
        blocks: [
          {
            type: 'list',
            items: [
              'Learn how weatherB markets work and how payouts are calculated.',
              'Place bets, track positions, and claim or refund winnings.',
              'Understand settlement, data sources, and trust assumptions.',
              'Find roadmap context.',
            ],
          },
        ],
      },
      {
        id: 'quick-start-3-minutes',
        title: 'Quick start (3 minutes)',
        blocks: [
          {
            type: 'list',
            ordered: true,
            items: [
              'Connect your wallet (Arc Testnet testnet).',
              'Pick an open market.',
              'Choose YES or NO and enter an amount (min 0.01 USDC).',
              'Confirm the transaction in your wallet.',
              'Track and claim in My Positions after settlement.',
            ],
          },
        ],
      },
      {
        id: 'key-rules-at-a-glance',
        title: 'Key rules at a glance',
        blocks: [
          {
            type: 'table',
            headers: ['Rule', 'Value'],
            rows: [
              ['Markets per day', '5 maximum'],
              [
                'Temperature precision',
                'Stored in tenths (e.g., 85.3F -> 853), shown as whole degrees',
              ],
              ['Tie rule', 'Temp == threshold means YES wins'],
              ['Betting closes', '10 minutes before resolve time'],
              ['Minimum bet', '0.01 USDC'],
              ['Currency', 'USDC only (V1)'],
              ['Who can resolve', 'Settler only'],
              ['Fees', '1% default, max 10%, taken from losing pool'],
            ],
          },
        ],
      },
      {
        id: 'trust-and-transparency',
        title: 'Trust and transparency',
        blocks: [
          {
            type: 'list',
            items: [
              'Markets and payouts are on-chain.',
              'Settlement is executed by a designated settler wallet.',
              'Weather data uses Tomorrow.io as a single provider.',
              'All resolution inputs are recorded on-chain.',
            ],
          },
        ],
      },
      {
        id: 'find-what-you-need',
        title: 'Find what you need',
        blocks: [
          {
            type: 'list',
            items: [
              '[Getting Started](/docs/getting-started)',
              '[Markets 101](/docs/markets-101)',
              '[Betting and Odds](/docs/betting-and-odds)',
              '[Settlement and Data Sources](/docs/settlement-and-data)',
              '[Using the App](/docs/using-the-app)',
              '[Refunds and Cancellations](/docs/refunds-and-cancellations)',
              '[Security and Governance](/docs/security-and-governance)',
              '[FAQ](/docs/faq)',
              '[Glossary](/docs/glossary)',
              '[Status and Roadmap](/docs/status-and-roadmap)',
              '[Community](/docs/community)',
            ],
          },
        ],
      },
      contractBlock,
      {
        id: 'disclaimer',
        title: 'Disclaimer',
        blocks: [
          {
            type: 'prose',
            markdown: 'weatherB is experimental software. Not financial advice. Use at your own risk.',
          },
        ],
      },
    ],
  },
  {
    slug: 'getting-started',
    title: 'Getting Started',
    sections: [
      {
        id: 'getting-started',
        title: 'Getting Started',
        blocks: [
          {
            type: 'prose',
            markdown: 'Start here if you want to place your first bet and understand the basic flow.',
          },
        ],
      },
      {
        id: 'what-you-can-do-here',
        title: 'What you can do here',
        blocks: [
          {
            type: 'list',
            items: [
              'Connect your wallet and confirm the correct network.',
              'Place a bet in an open market.',
              'Track your position and claim or refund later.',
            ],
          },
        ],
      },
      {
        id: 'step-1-connect-your-wallet',
        title: 'Step 1: Connect your wallet',
        blocks: [
          {
            type: 'list',
            items: [
              'Use the "Connect Wallet" button in the header.',
              'weatherB uses Thirdweb and WalletConnect for easy onboarding.',
              'Make sure your wallet is on Arc Testnet (testnet). If you are on mainnet, you will be prompted to switch.',
            ],
          },
        ],
      },
      {
        id: 'step-2-choose-a-market',
        title: 'Step 2: Choose a market',
        blocks: [
          {
            type: 'list',
            items: [
              'Go to the Markets page (home).',
              'Each card shows the city, threshold, resolve time, and current odds.',
              'Only markets labeled "Open" accept bets. "Closed" means betting is over but the market has not resolved yet.',
            ],
          },
        ],
      },
      {
        id: 'step-3-place-a-bet',
        title: 'Step 3: Place a bet',
        blocks: [
          {
            type: 'list',
            items: [
              'Click YES or NO on the market card.',
              'Enter your amount (minimum is 0.01 USDC).',
              'Review the payout preview and confirm the transaction in your wallet.',
              'After confirmation, you will see a transaction link to the explorer.',
            ],
          },
        ],
      },
      {
        id: 'step-4-track-your-position',
        title: 'Step 4: Track your position',
        blocks: [
          {
            type: 'list',
            items: [
              'Go to "My Positions" in the header.',
              'Your positions are grouped by status: active, claimable, claimed, or past.',
              'You can place multiple bets on a single market. The contract will accumulate your YES and NO amounts.',
            ],
          },
        ],
      },
      {
        id: 'step-5-claim-or-refund',
        title: 'Step 5: Claim or refund',
        blocks: [
          {
            type: 'list',
            items: [
              'After settlement, claimable positions will show a "Claim" action.',
              'Cancelled or No Winners markets show "Refund" instead.',
              'Claims and refunds are on-chain transactions and require wallet confirmation.',
            ],
          },
        ],
      },
      {
        id: 'optional-suggest-a-market',
        title: 'Optional: Suggest a market',
        blocks: [
          {
            type: 'list',
            items: [
              'Visit the Suggestions page to propose a new city and time window.',
              'Vote on ideas from other community members.',
            ],
          },
        ],
      },
      {
        id: 'deeper-walkthrough',
        title: '',
        blocks: [
          {
            type: 'prose',
            markdown: 'If you want a deeper walkthrough, see [Using the App](/docs/using-the-app).',
          },
        ],
      },
    ],
  },
  {
    slug: 'markets-101',
    title: 'Markets 101',
    sections: [
      {
        id: 'markets-101',
        title: 'Markets 101',
        blocks: [
          {
            type: 'prose',
            markdown:
              'This page explains how weatherB markets are structured, how time and temperature work, and what each status means.',
          },
        ],
      },
      {
        id: 'what-you-can-do-here',
        title: 'What you can do here',
        blocks: [
          {
            type: 'list',
            items: [
              'Learn the exact market question format and rules.',
              'Understand temperature precision and the tie rule.',
              'See how market status changes over time.',
            ],
          },
        ],
      },
      {
        id: 'market-question-format',
        title: 'Market question format',
        blocks: [
          {
            type: 'prose',
            markdown:
              'Every market is a simple YES/NO question:\n\n"Will the temperature be >= X F at time T in City?"\n\nExample: "Will the temperature be >= 72F in New York City at 2:00pm?"',
          },
        ],
      },
      {
        id: 'temperature-precision',
        title: 'Temperature precision',
        blocks: [
          {
            type: 'list',
            items: [
              'Temperatures are stored as tenths of a degree (85.3F is stored as 853).',
              'The app displays whole degrees for clarity (85.3F is shown as 85F).',
            ],
          },
        ],
      },
      {
        id: 'tie-rule',
        title: 'Tie rule',
        blocks: [
          {
            type: 'prose',
            markdown: 'If the observed temperature equals the threshold, YES wins. The rule is always >=.',
          },
        ],
      },
      {
        id: 'betting-window',
        title: 'Betting window',
        blocks: [
          {
            type: 'list',
            items: [
              'Markets open when created.',
              'Betting closes 10 minutes before the resolve time.',
              'After betting closes, the market status becomes "Closed" until it resolves.',
            ],
          },
        ],
      },
      {
        id: 'market-lifecycle',
        title: 'Market lifecycle',
        blocks: [
          {
            type: 'prose',
            markdown: 'Screenshot placeholder: add `assets/market-lifecycle.png`',
          },
        ],
      },
      {
        id: 'market-statuses',
        title: 'Market statuses',
        blocks: [
          {
            type: 'table',
            headers: ['Status', 'Meaning', 'What you can do'],
            rows: [
              ['Open', 'Betting is live', 'Place YES or NO bets'],
              ['Closed', 'Betting ended, waiting to resolve', 'Wait for settlement'],
              ['Resolved', 'Outcome is final', 'Claim winnings if you won'],
              ['Cancelled', 'Market was cancelled', 'Refund your bet'],
              ['NoWinners', 'Winning pool was empty', 'Refund your bet'],
            ],
          },
        ],
      },
      {
        id: 'rules-and-constraints',
        title: 'Rules and constraints',
        blocks: [
          {
            type: 'table',
            headers: ['Rule', 'Value'],
            rows: [
              ['Markets per day', '5 maximum'],
              ['Multiple bets per wallet', 'Allowed (bets accumulate)'],
              ['Temperature storage', 'Tenths of a degree (e.g., 85.3F -> 853)'],
              ['Display precision', 'Whole degrees only'],
              ['Tie rule', 'Temp == threshold means YES wins'],
              ['Currency', 'USDC only (V1)'],
              ['Settlement', 'Only settler can resolve'],
              ['Fee', '1% default, max 10%, from losing pool'],
              ['Betting close buffer', '10 minutes before resolve time'],
              ['Minimum bet', '0.01 USDC'],
            ],
          },
        ],
      },
      {
        id: 'multiple-bets-and-sides',
        title: 'Multiple bets and sides',
        blocks: [
          {
            type: 'prose',
            markdown:
              'You can place multiple bets on the same market. The contract tracks your YES and NO amounts separately. If you bet both sides, your final payout depends on the winning side only.',
          },
        ],
      },
      {
        id: 'time-zones',
        title: 'Time zones',
        blocks: [
          {
            type: 'prose',
            markdown: 'Resolve times are shown in your local time zone. On-chain timestamps are stored in UTC seconds.',
          },
        ],
      },
    ],
  },
  {
    slug: 'betting-and-odds',
    title: 'Betting and Odds',
    sections: [
      {
        id: 'betting-and-odds',
        title: 'Betting and Odds',
        blocks: [
          {
            type: 'prose',
            markdown:
              'weatherB uses parimutuel pools. Your payout depends on the final YES and NO pools at settlement.',
          },
        ],
      },
      {
        id: 'what-you-can-do-here',
        title: 'What you can do here',
        blocks: [
          {
            type: 'list',
            items: [
              'Understand how odds are calculated from pools.',
              'See how fees affect payouts.',
              'Walk through a simple payout example.',
            ],
          },
        ],
      },
      {
        id: 'parimutuel-pools',
        title: 'Parimutuel pools',
        blocks: [
          {
            type: 'prose',
            markdown: 'Each market has two pools:',
          },
          {
            type: 'list',
            items: ['YES pool: total USDC bet on YES', 'NO pool: total USDC bet on NO'],
          },
          {
            type: 'prose',
            markdown:
              'When the market resolves, winners split the losing pool proportionally to their share of the winning pool.',
          },
        ],
      },
      {
        id: 'implied-odds',
        title: 'Implied odds',
        blocks: [
          {
            type: 'prose',
            markdown: 'Odds are implied by pool sizes, not fixed by the house. As pools change, odds move.',
          },
          {
            type: 'prose',
            markdown: 'Example:',
          },
          {
            type: 'list',
            items: [
              'If YES has 40% of the total pool, implied YES probability is about 40%.',
              'If NO has 60% of the total pool, implied NO probability is about 60%.',
            ],
          },
        ],
      },
      {
        id: 'fee-model',
        title: 'Fee model',
        blocks: [
          {
            type: 'list',
            items: [
              'The protocol takes a fee from the losing pool.',
              'Default fee is 1% of the losing pool.',
              'Maximum fee is capped at 10%.',
            ],
          },
        ],
      },
      {
        id: 'payout-formula-simplified',
        title: 'Payout formula (simplified)',
        blocks: [
          {
            type: 'prose',
            markdown: 'If YES wins:',
          },
          {
            type: 'prose',
            markdown: '`payout = stake + (stake / yesPool) * (noPool - fee)`',
          },
          {
            type: 'prose',
            markdown: 'If NO wins, swap yesPool and noPool.',
          },
        ],
      },
      {
        id: 'payout-example',
        title: 'Payout example',
        blocks: [
          {
            type: 'prose',
            markdown: 'Assume the following at settlement:',
          },
          {
            type: 'list',
            items: [
              'YES pool: 40 USDC',
              'NO pool: 60 USDC',
              'Fee: 1% of losing pool = 0.6 USDC',
              'Your YES stake: 10 USDC',
            ],
          },
          {
            type: 'prose',
            markdown: 'Your payout:',
          },
          {
            type: 'list',
            items: [
              'Net losing pool = 60 - 0.6 = 59.4',
              'Share of losing pool = (10 / 40) * 59.4 = 14.85',
              'Total payout = 10 + 14.85 = 24.85 USDC',
            ],
          },
        ],
      },
      {
        id: 'payout-preview-vs-final-payout',
        title: 'Payout preview vs final payout',
        blocks: [
          {
            type: 'prose',
            markdown:
              'The app shows a payout preview when you place a bet. The final payout is based on the pools at settlement, so it may change as other users bet.',
          },
        ],
      },
      {
        id: 'no-winners-case',
        title: 'No winners case',
        blocks: [
          {
            type: 'prose',
            markdown:
              'If there are zero bets on the winning side, the market resolves as NoWinners and everyone can refund their stake.',
          },
          {
            type: 'prose',
            markdown: 'Diagram placeholder: add `assets/payout-example.png`',
          },
        ],
      },
    ],
  },
  {
    slug: 'settlement-and-data',
    title: 'Settlement and Data Sources',
    sections: [
      {
        id: 'settlement-and-data-sources',
        title: 'Settlement and Data Sources',
        blocks: [
          {
            type: 'prose',
            markdown:
              'weatherB settlement is automated and based on a clear data rule: the first reading at or after the resolve time.',
          },
        ],
      },
      {
        id: 'what-you-can-do-here',
        title: 'What you can do here',
        blocks: [
          {
            type: 'list',
            items: [
              'Understand how settlement works end to end.',
              'See which weather providers are used and in what order.',
              'Learn how weatherB handles missing or delayed data.',
            ],
          },
        ],
      },
      {
        id: 'settlement-overview',
        title: 'Settlement overview',
        blocks: [
          {
            type: 'list',
            ordered: true,
            items: [
              'A market reaches its resolve time.',
              'The settler service fetches weather data.',
              'The contract resolves the market with the observed temperature.',
              'Winners can claim, or everyone can refund if there are no winners.',
            ],
          },
          {
            type: 'prose',
            markdown: 'Settlement is performed by a designated settler wallet. Users cannot resolve markets directly.',
          },
        ],
      },
      {
        id: 'weather-data-sources',
        title: 'Weather data sources',
        blocks: [
          {
            type: 'prose',
            markdown:
              'weatherB uses Tomorrow.io as a single provider for settlement data.',
          },
          {
            type: 'table',
            headers: ['Provider', 'Notes'],
            rows: [
              ['Tomorrow.io', 'Realtime readings used at resolve time'],
            ],
          },
        ],
      },
      {
        id: 'reading-rule',
        title: 'Reading rule',
        blocks: [
          {
            type: 'prose',
            markdown:
              'The resolver uses the first reading at or after the resolve time (T). This prevents cherry-picking and makes settlement deterministic.',
          },
        ],
      },
      {
        id: 'data-flow',
        title: 'Data flow',
        blocks: [
          {
            type: 'prose',
            markdown: 'Diagram placeholder: add `assets/settlement-data-flow.png`',
          },
        ],
      },
      {
        id: 'if-data-is-missing-or-delayed',
        title: 'If data is missing or delayed',
        blocks: [
          {
            type: 'list',
            items: [
              'The settler retries with the same provider.',
              'If reliable data cannot be obtained, the market may be cancelled by the owner or settler.',
              'Cancelled or NoWinners markets are refundable.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'using-the-app',
    title: 'Using the App',
    sections: [
      {
        id: 'using-the-app',
        title: 'Using the App',
        blocks: [
          {
            type: 'prose',
            markdown: 'This walkthrough maps the main screens to the actions you will take as a user.',
          },
        ],
      },
      {
        id: 'what-you-can-do-here',
        title: 'What you can do here',
        blocks: [
          {
            type: 'list',
            items: [
              'Navigate markets, place a bet, and view outcomes.',
              'Track positions and claim winnings.',
              'Suggest and vote on new markets.',
            ],
          },
        ],
      },
      {
        id: 'markets-page',
        title: 'Markets page',
        blocks: [
          {
            type: 'prose',
            markdown:
              'The Markets page shows active and closed markets in a hero carousel and grid.\n\nScreenshot placeholder: add `assets/markets-page.png`',
          },
          {
            type: 'prose',
            markdown: 'What you will see:',
          },
          {
            type: 'list',
            items: [
              'City name and temperature threshold',
              'Resolve countdown and status',
              'Current odds and pools',
              'YES and NO buttons for open markets',
              'A Past Markets drawer to view resolved and cancelled markets on demand',
            ],
          },
        ],
      },
      {
        id: 'bet-flow-modal',
        title: 'Bet flow (modal)',
        blocks: [
          {
            type: 'prose',
            markdown: 'Clicking YES or NO opens the bet modal.\n\nScreenshot placeholder: add `assets/bet-modal.png`',
          },
          {
            type: 'prose',
            markdown: 'What you will see:',
          },
          {
            type: 'list',
            items: [
              'The market question and resolve time',
              'Amount input with quick presets',
              'Payout preview and implied odds',
              'Transaction confirmation and explorer link',
            ],
          },
        ],
      },
      {
        id: 'market-summary-modal',
        title: 'Market summary modal',
        blocks: [
          {
            type: 'prose',
            markdown: 'Click a past market to see the full summary.\n\nScreenshot placeholder: add `assets/market-summary.png`',
          },
          {
            type: 'prose',
            markdown: 'What you will see:',
          },
          {
            type: 'list',
            items: [
              'Observed temperature and threshold',
              'Final outcome (YES, NO, or No Winners)',
              'Pool breakdown and total volume',
            ],
          },
        ],
      },
      {
        id: 'positions-page',
        title: 'Positions page',
        blocks: [
          {
            type: 'prose',
            markdown: 'The Positions page aggregates your bets.\n\nScreenshot placeholder: add `assets/positions-page.png`',
          },
          {
            type: 'prose',
            markdown: 'What you will see:',
          },
          {
            type: 'list',
            items: [
              'Stats dashboard (win rate, totals, claimable)',
              'Tabs for active, claimable, claimed, and past',
              'Claim or refund actions when available',
            ],
          },
        ],
      },
      {
        id: 'claim-flow',
        title: 'Claim flow',
        blocks: [
          {
            type: 'prose',
            markdown: 'Claiming or refunding is a separate on-chain transaction.\n\nScreenshot placeholder: add `assets/claim-flow.png`',
          },
        ],
      },
      {
        id: 'suggestions-page',
        title: 'Suggestions page',
        blocks: [
          {
            type: 'prose',
            markdown: 'Suggest new markets and vote on community ideas.\n\nScreenshot placeholder: add `assets/suggestions-page.png`',
          },
          {
            type: 'prose',
            markdown: 'What you will see:',
          },
          {
            type: 'list',
            items: [
              'Suggestion form for city and time window',
              'Vote counts and trending ideas',
              'Your own vote state',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'refunds-and-cancellations',
    title: 'Refunds and Cancellations',
    sections: [
      {
        id: 'refunds-and-cancellations',
        title: 'Refunds and Cancellations',
        blocks: [
          {
            type: 'prose',
            markdown: 'Refunds are available when a market is cancelled or ends with no winners.',
          },
        ],
      },
      {
        id: 'what-you-can-do-here',
        title: 'What you can do here',
        blocks: [
          {
            type: 'list',
            items: [
              'Understand when refunds apply.',
              'See the difference between Cancelled and NoWinners.',
              'Learn how to claim a refund.',
            ],
          },
        ],
      },
      {
        id: 'when-refunds-happen',
        title: 'When refunds happen',
        blocks: [
          {
            type: 'prose',
            markdown: 'Refunds are available in two cases:',
          },
          {
            type: 'list',
            ordered: true,
            items: ['Cancelled markets', 'NoWinners markets (winning pool is zero)'],
          },
        ],
      },
      {
        id: 'cancelled-markets',
        title: 'Cancelled markets',
        blocks: [
          {
            type: 'list',
            items: [
              'A market can be cancelled by the owner or settler.',
              'Your full stake is refundable.',
              'The UI will show a Refund action in My Positions.',
            ],
          },
        ],
      },
      {
        id: 'nowinners-markets',
        title: 'NoWinners markets',
        blocks: [
          {
            type: 'list',
            items: [
              'If the winning side has zero bets, the market resolves as NoWinners.',
              'All bettors can refund their full stake.',
            ],
          },
        ],
      },
      {
        id: 'how-to-refund',
        title: 'How to refund',
        blocks: [
          {
            type: 'list',
            ordered: true,
            items: [
              'Open My Positions.',
              'Find the market in the Claimable tab.',
              'Click Refund and confirm the transaction in your wallet.',
            ],
          },
        ],
      },
      {
        id: 'status-and-actions',
        title: 'Status and actions',
        blocks: [
          {
            type: 'table',
            headers: ['Status', 'What it means', 'Action'],
            rows: [
              ['Resolved', 'Outcome is final', 'Claim if you won'],
              ['Cancelled', 'Market stopped', 'Refund full stake'],
              ['NoWinners', 'No winning bets', 'Refund full stake'],
              ['Open or Closed', 'Not settled yet', 'Wait'],
            ],
          },
        ],
      },
      {
        id: 'important-notes',
        title: 'Important notes',
        blocks: [
          {
            type: 'list',
            items: [
              'Refunds and claims are on-chain transactions.',
              'You can only claim or refund once per market.',
              'If you placed multiple bets on a market, refunds include your total stake.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'security-and-governance',
    title: 'Security and Governance',
    includeContractBlock: false,
    sections: [
      {
        id: 'security-and-governance',
        title: 'Security and Governance',
        blocks: [
          {
            type: 'prose',
            markdown: 'This page explains how roles, permissions, and limits work in weatherB.',
          },
        ],
      },
      {
        id: 'what-you-can-do-here',
        title: 'What you can do here',
        blocks: [
          {
            type: 'list',
            items: [
              'Understand who can do what on-chain.',
              'Review upgradeability and fee limits.',
              'Learn the core trust assumptions.',
            ],
          },
        ],
      },
      {
        id: 'roles',
        title: 'Roles',
        blocks: [
          {
            type: 'table',
            headers: ['Role', 'What they can do'],
            rows: [
              ['Owner', 'Create markets, pause/unpause, set parameters, cancel markets, withdraw fees'],
              ['Settler', 'Resolve markets and cancel markets'],
              ['User', 'Place bets, claim winnings, request refunds'],
            ],
          },
        ],
      },
      {
        id: 'upgradeability',
        title: 'Upgradeability',
        blocks: [
          {
            type: 'prose',
            markdown:
              'weatherB uses a UUPS upgradeable contract. The owner can upgrade the contract implementation. This allows bug fixes and improvements but requires trust in the owner key.',
          },
        ],
      },
      {
        id: 'admin-capabilities-vs-limitations',
        title: 'Admin capabilities vs limitations',
        blocks: [
          {
            type: 'table',
            headers: ['Admin CAN', 'Admin CANNOT'],
            rows: [
              ['Create markets', 'Change outcomes after resolution'],
              ['Pause betting', 'Resolve markets (settler only)'],
              ['Cancel markets', 'Withdraw user stakes'],
              ['Set fee, min bet, and betting buffer', 'Bypass on-chain rules'],
              ['Update settler address', 'Claim winnings for users'],
            ],
          },
        ],
      },
      {
        id: 'fees-and-limits',
        title: 'Fees and limits',
        blocks: [
          {
            type: 'list',
            items: [
              'Default fee is 1% of the losing pool.',
              'Maximum fee is capped at 10%.',
              'Minimum bet is 0.01 USDC.',
              'Betting closes 10 minutes before resolve time.',
            ],
          },
        ],
      },
      {
        id: 'pause-controls',
        title: 'Pause controls',
        blocks: [
          {
            type: 'prose',
            markdown:
              'The owner can pause betting, claims, and refunds during emergencies. Pausing does not change market outcomes.',
          },
        ],
      },
      contractBlock,
      {
        id: 'trust-assumptions',
        title: 'Trust assumptions',
        blocks: [
          {
            type: 'list',
            items: [
              'Settlement is performed by a designated settler wallet.',
              'Weather data comes from a trusted third-party provider (Tomorrow.io).',
              'Upgrades are possible and visible on-chain.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'faq',
    title: 'FAQ',
    sections: [
      {
        id: 'faq',
        title: 'FAQ',
        blocks: [
          {
            type: 'prose',
            markdown: 'Short answers to the most common questions.',
          },
        ],
      },
      {
        id: 'what-you-can-do-here',
        title: 'What you can do here',
        blocks: [
          {
            type: 'list',
            items: [
              'Find quick answers without digging through the full docs.',
              'Understand common edge cases and rules.',
            ],
          },
        ],
      },
      {
        id: 'why-only-5-markets-per-day',
        title: 'Why only 5 markets per day?',
        blocks: [
          {
            type: 'prose',
            markdown:
              'weatherB limits market supply in V1 to keep operations predictable and reduce settlement risk while the product matures.',
          },
        ],
      },
      {
        id: 'why-does-betting-close-early',
        title: 'Why does betting close early?',
        blocks: [
          {
            type: 'prose',
            markdown:
              'Betting closes 10 minutes before resolve time to ensure all bets are finalized before settlement.',
          },
        ],
      },
      {
        id: 'can-i-bet-both-sides',
        title: 'Can I bet both sides?',
        blocks: [
          {
            type: 'prose',
            markdown:
              'Yes. The contract allows multiple bets per wallet, including on both YES and NO. Your payout is based on the winning side only.',
          },
        ],
      },
      {
        id: 'when-will-i-see-my-winnings',
        title: 'When will I see my winnings?',
        blocks: [
          {
            type: 'prose',
            markdown:
              'After the market resolves. If you won, the position becomes claimable and you can claim on-chain.',
          },
        ],
      },
      {
        id: 'what-network-is-available',
        title: 'What network is available?',
        blocks: [
          {
            type: 'prose',
            markdown: 'Arc Testnet testnet today. mainnet (not scheduled) is planned for a future phase.',
          },
        ],
      },
      {
        id: 'what-happens-if-no-one-is-on-the-winning-side',
        title: 'What happens if no one is on the winning side?',
        blocks: [
          {
            type: 'prose',
            markdown: 'The market resolves as NoWinners. Everyone can refund their full stake.',
          },
        ],
      },
      {
        id: 'can-the-team-change-outcomes',
        title: 'Can the team change outcomes?',
        blocks: [
          {
            type: 'prose',
            markdown:
              'The contract computes the outcome from the temperature submitted by the settler using the >= rule. The settler provides the observed temperature, which is a trust assumption in V1.',
          },
        ],
      },
      {
        id: 'what-fees-are-charged',
        title: 'What fees are charged?',
        blocks: [
          {
            type: 'prose',
            markdown: 'A fee is taken from the losing pool. The default is 1%, with a maximum cap of 10%.',
          },
        ],
      },
      {
        id: 'how-are-temperatures-measured',
        title: 'How are temperatures measured?',
        blocks: [
          {
            type: 'prose',
            markdown:
              'The settler uses the first reading at or after the resolve time from the configured provider.',
          },
        ],
      },
      {
        id: 'where-can-i-verify-my-transaction',
        title: 'Where can I verify my transaction?',
        blocks: [
          {
            type: 'prose',
            markdown:
              'The bet and claim modals include a link to the Arc explorer after confirmation.',
          },
        ],
      },
    ],
  },
  {
    slug: 'glossary',
    title: 'Glossary',
    sections: [
      {
        id: 'glossary',
        title: 'Glossary',
        blocks: [
          {
            type: 'prose',
            markdown: 'Definitions of common terms used in weatherB.',
          },
        ],
      },
      {
        id: 'what-you-can-do-here',
        title: 'What you can do here',
        blocks: [
          {
            type: 'list',
            items: ['Look up unfamiliar terms quickly.'],
          },
        ],
      },
      {
        id: 'glossary-terms',
        title: '',
        blocks: [
          {
            type: 'list',
            items: [
              'Market: A single YES/NO prediction question tied to a city and time.',
              'Resolve time: The timestamp when the market can be settled.',
              'Threshold: The temperature target the market is based on.',
              'Betting deadline: The time betting closes (10 minutes before resolve time).',
              'Pool: Total amount bet on one side (YES or NO).',
              'Parimutuel: Payouts are based on pool sizes, not fixed odds.',
              'Settler: The designated wallet allowed to resolve markets.',
              'NoWinners: A resolved market with no bets on the winning side; refunds apply.',
              'Cancelled: A market that was stopped before resolution; refunds apply.',
              'Fee: Percentage taken from the losing pool.',
              'USDC: The native token of Arc.',
              'USDC: The native token on Arc Testnet.',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'status-and-roadmap',
    title: 'Status and Roadmap',
    sections: [
      {
        id: 'status-and-roadmap',
        title: 'Status and Roadmap',
        blocks: [
          {
            type: 'prose',
            markdown: 'This page summarizes the current release stage and what is planned next.',
          },
        ],
      },
      {
        id: 'what-you-can-do-here',
        title: 'What you can do here',
        blocks: [
          {
            type: 'list',
            items: [
              'Understand what is live today and what is still in progress.',
              'See the path from testnet to mainnet.',
            ],
          },
        ],
      },
      {
        id: 'current-state-testnet',
        title: 'Current state (testnet)',
        blocks: [
          {
            type: 'list',
            items: [
              'Network: Arc Testnet (Arc testnet)',
              'Settlement: Trusted settler role (centralized oracle)',
              'Markets: rotating cities (configurable), temperature-only, 5 markets/day',
              'Features: Core betting, parimutuel pools, automated settlement, suggestion voting',
            ],
          },
        ],
      },
      {
        id: 'technical-maturity-stages',
        title: 'Technical maturity stages',
        blocks: [
          {
            type: 'prose',
            markdown: 'Stage 1: Foundation (Epics 0-7) - Complete',
          },
          {
            type: 'list',
            items: [
              'Parimutuel contract with UUPS upgradeability',
              'Tomorrow.io weather data (single provider)',
              'Admin panel for market management',
              'Community suggestion and voting system',
            ],
          },
          {
            type: 'prose',
            markdown: 'Stage 2: Testing and Reliability (Epic 8) - In Progress',
          },
          {
            type: 'list',
            items: [
              'Automated test market system with ~4.5-hour end-to-end validation',
              'Weekly AI-generated performance reports (planned)',
              'Enhanced monitoring and diagnostics',
            ],
          },
          {
            type: 'prose',
            markdown: 'Stage 3: Indexing and Performance (Epic 9) - Planned',
          },
          {
            type: 'list',
            items: [
              'Custom indexer (listener + Prisma) for historical data and analytics',
              'Optimized query performance for large datasets',
            ],
          },
          {
            type: 'prose',
            markdown: 'Stage 4: Security Hardening (Epic 10) - Planned',
          },
          {
            type: 'list',
            items: [
              'Formal security audit',
              'Emergency pause mechanisms refinement',
              'Role-based access control review',
            ],
          },
        ],
      },
      {
        id: 'path-to-mainnet',
        title: 'Path to mainnet',
        blocks: [
          {
            type: 'prose',
            markdown: 'Phase 1: Testnet validation (current)',
          },
          {
            type: 'list',
            items: [
              'Continuous testing on Arc Testnet',
              'Gather feedback from early users',
              'Refine UX based on real usage patterns',
              'Automated testing of edge cases and settlement reliability',
            ],
          },
          {
            type: 'prose',
            markdown: 'Phase 2: Mainnet beta (user validation)',
          },
          {
            type: 'list',
            items: [
              'Deploy to mainnet (not scheduled) with limited exposure',
              'Invite-only or soft launch to community',
              'Monitor real-money markets with low caps',
              'Validate economic assumptions and payout mechanics',
            ],
          },
          {
            type: 'prose',
            markdown: 'Phase 3: Public launch (growth and marketing)',
          },
          {
            type: 'list',
            items: [
              'Full public access on mainnet (not scheduled)',
              'Marketing campaigns and community growth',
              'Expand to more cities and weather types',
              'Potential for governance token or community rewards',
            ],
          },
        ],
      },
      {
        id: 'future-possibilities-not-committed',
        title: 'Future possibilities (not committed)',
        blocks: [
          {
            type: 'list',
            items: [
              'Multi-chain expansion beyond Arc',
              'Decentralized oracle network (replace trusted settler)',
              'Custom market creation by users',
              'Sports, events, or other prediction types',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'community',
    title: 'Community',
    sections: [
      {
        id: 'community',
        title: 'Community',
        blocks: [
          {
            type: 'prose',
            markdown: 'Use this page to connect with weatherB and follow updates.',
          },
        ],
      },
      {
        id: 'what-you-can-do-here',
        title: 'What you can do here',
        blocks: [
          {
            type: 'list',
            items: [
              'Find official channels for updates.',
              'Suggest new markets and vote on ideas.',
            ],
          },
        ],
      },
      {
        id: 'stay-connected',
        title: 'Stay connected',
        blocks: [
          {
            type: 'prose',
            markdown: 'Follow [@weatherbapp](https://twitter.com/weatherbapp) on Twitter/X for:',
          },
          {
            type: 'list',
            items: [
              'Market announcements and highlights',
              'Settlement results and interesting outcomes',
              'Platform updates and new features',
              'Community spotlights and suggestion updates',
            ],
          },
        ],
      },
      {
        id: 'contributing-ideas',
        title: 'Contributing ideas',
        blocks: [
          {
            type: 'list',
            items: [
              'Use the Suggestions page to propose new markets.',
              'Vote on ideas from other users.',
              'Top-voted suggestions are reviewed first, but scheduling is not guaranteed.',
            ],
          },
        ],
      },
    ],
  },
];
