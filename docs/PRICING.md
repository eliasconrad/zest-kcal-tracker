# Pricing (October 30, 2026): proposals, Elias decides

## Cost per person

Measured on the current model (`qwen/qwen2.5-vl-72b-instruct`, `docs/MODEL_PLAN.md`): one scan costs **$0.00058**, 958 tokens in and 41 out. Listed price $0.80 in and $1.00 out per million tokens. A question to Zest is roughly 500 tokens in and 150 out, so about $0.00055. That one is calculated, not measured.

| Use | Scans a day | Questions a day | Model cost a month |
| --- | --- | --- | --- |
| Free limit, used fully | 3 | 2 | $0.09 |
| Typical Pro | 3 | 2 | $0.09 |
| Heavy Pro | 6 | 2 | $0.14 |

Switching to a cheaper model after the comparison in `MODEL_PLAN.md` could lower this further.

Cloudflare, from the published Workers paid plan (check the current list before relying on it): $5 a month includes 10 million requests and generous D1 limits. A heavy month is about 12 requests a day for each person.

| Monthly actives | Requests a month | Cloudflare | Model cost, typical | Total a month |
| --- | --- | --- | --- | --- |
| 1,000 | 360,000 | $5 | $90 | about $95 |
| 10,000 | 3.6 million | $5 | $900 | about $905 |
| 100,000 | 36 million | about $13 | $9,000 | about $9,000 |

These assume everyone uses the limit every day, which real people do not, so they are upper bounds.

## What the market charges

Annual plans seen: Cal AI $29.99, BitePal $35.99, fatsecret $38.99, Calo $39.99, YAZIO $47.90, Lean $59.99, MyFitnessPal and SnapCalorie $79.99. Monthly plans: Cal AI $9.99, fatsecret $14.99, MyFitnessPal $19.99.

## Proposal

| | Free | Pro monthly | Pro yearly |
| --- | --- | --- | --- |
| Scans | 3 a day | unlimited | unlimited |
| Questions to Zest | 10 a day | unlimited | unlimited |
| Diary, streak, calendar, recipes | yes | yes | yes |
| Recipe suggestions from the model | counted as questions | unlimited | unlimited |
| Sync and friends | yes, with a free account | yes | yes |
| DE, AT | | €7.99 | €29.99 |
| CH | | CHF 8.00 | CHF 30.00 |
| US | | $7.99 | $29.99 |
| UK | | £6.99 | £24.99 |

Reasoning: Cal AI, the closest product, sits at $29.99 a year, and being cheaper than the market's middle fits an unknown brand. The price stays round and honest, with no fake "was" price.

Per yearly subscriber in Germany: €29.99 includes 19 % VAT, leaving €25.20. Apple keeps 15 % in the Small Business Program, leaving €21.42, or 30 % above $1 million a year, leaving €17.64. A heavy user costs about $1.70 a year in model fees, so the margin holds even at the higher Apple cut.

**A free tier cannot literally never lose money.** A free person earns nothing and costs up to $0.09 a month at the full limit. At that rate, one yearly subscriber pays for about 20 people on the full free limit for a year. Lower the limit to 2 scans if conversion turns out below 5 %.

Friends and sync stay free, unlike the first idea, because friends bring people back and gating them would cost more than it earns. The prompt suggested 60 scans a day on free. That would cost $1 a month per person with no income, so the limit here is 3, set by `FREE_SCANS_PER_DAY` in `server/wrangler.jsonc`.

## Needs Elias

The final prices, whether to offer a trial (a 7-day introductory offer has to be set in App Store Connect; the paywall only mentions a trial if the store returns one), and creating `eu.eliasconrad.zest.pro.monthly` and `eu.eliasconrad.zest.pro.yearly` there.
