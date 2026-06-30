# FAQ

Short answers to the most common questions.

## What you can do here
- Find quick answers without digging through the full docs.
- Understand common edge cases and rules.

## Why only 5 markets per day?
weatherB limits market supply in V1 to keep operations predictable and reduce settlement risk while the product matures.

## Why does betting close early?
Betting closes 10 minutes before resolve time to ensure all bets are finalized before settlement.

## Can I bet both sides?
Yes. The contract allows multiple bets per wallet, including on both YES and NO. Your payout is based on the winning side only.

## When will I see my winnings?
After the market resolves. If you won, the position becomes claimable and you can claim on-chain.

## What network is available?
Coston2 testnet today. Flare mainnet is planned for a future phase.

## What happens if no one is on the winning side?
The market resolves as NoWinners. Everyone can refund their full stake.

## Can the team change outcomes?
The contract computes the outcome from the temperature submitted by the settler using the >= rule. The settler provides the observed temperature, which is a trust assumption in V1.

## What fees are charged?
A fee is taken from the losing pool. The default is 1%, with a maximum cap of 10%.

## How are temperatures measured?
The settler uses the first reading at or after the resolve time from the configured provider.

## Where can I verify my transaction?
The bet and claim modals include a link to the Flare explorer after confirmation.

## Contract and Explorer
- App: https://weatherb.app
- Contract (Coston2): 0x716186B29043840a165e1Faf49b85bc2101fAaC7
- Explorer: https://coston2-explorer.flare.network/address/0x716186B29043840a165e1Faf49b85bc2101fAaC7
