# Paywall research (October 30, 2026)

Source: the paywall sections of ten calorie trackers in Appllama plus the in-app purchases each app lists on the store. Twelve screens were read as images, the rest by their metadata. Prices are what the screens and store lists show in USD.

| App | Where it appears | Plans shown | Trial | Hard or soft | Works | Bad |
| --- | --- | --- | --- | --- | --- | --- |
| **Cal AI** | End of onboarding, after sign-in | $9.99 a month, $29.99 a year | 3 days, with a timeline Today, In 2 days reminder, In 3 days billing | Hard: "to continue" | The trial timeline explains billing before anyone asks; "No payment due now"; a phone mockup shows the product | No way past it |
| **YAZIO** | After the plan, with the name of the goal ("to hit 70 kg by September 29") | 12 months $47.90, 3 months $23.99 | none on this screen | Soft, close button; then a spin wheel with "75 % off forever" | The goal in the headline is the strongest line in the set | Struck-through price, fake wheel of chance |
| **BitePal** | After the personal summary | Annual $35.99, $2.99 a month, more plans folded | none | Soft, close button | Mascot on top, free and Plus compared in a table | "4.2x faster" with no source; struck-through price |
| **Cal Scanner** | Before first use | $9.99 a month, $39.99 lifetime, $49.99 a year; a coin pack beside it | one variant 7 days | Soft | Lifetime next to subscription; the feature list | "200 deals a day, only 3 left": invented scarcity; three pricing concepts at once |
| **Calo** | End of onboarding, then "One time offer" | Free 7 days then $39.99 a year, or $2.99 first month | 7 days | Soft; exit offer | "Remind me before the trial ends" toggle; camera photo as hero | "Lowest price ever" and a 50 % exit offer "forever" |
| **MyFitnessPal** | End of onboarding | $79.99 a year, $19.99 a month | 7 days | Soft | Plain plan cards, a clear close | Dark coupon screen with "ends soon" |
| **fatsecret** | End of onboarding | $38.99 a year, $19.99 for 3 months, $14.99 a month | none | Soft | Three plans read at a glance | "Limited offer" and struck prices |
| **Lean** | End of onboarding | $59.99 a year, more in a sheet | none shown | Soft, Restore on top | Benefit timeline in the person's words: today, 7 days, 4 weeks | Laurel badge, "83 % off" |
| **SnapCalorie** | End of onboarding | $79.99 a year | 7 days | Soft | One product, one price, one big photo | 80 % exit offer |
| **Fitia** | End of onboarding | Family and individual yearly, monthly; coin store | Trial timeline | Soft | Family plan | A countdown timer and a coin economy on top |

## Hardcoded or remote?

Nobody outside can see this for sure, so this is inference from the evidence:

- **Remote-configured, most likely, for all of the larger apps.** Each lists many different prices for the same plan on the store: Cal AI's annual plan at $19.99 and $29.99, BitePal's at $23.99, $29.99, $35.99, $39.99 and $59.99, YAZIO's between $11.90 and $47.90. Copy and layout also differ between recorded variants of one app (Cal Scanner has two completely different paywalls). That many price points only make sense with server-driven experiments.
- **Prices on screen match store entries**, so they come from the store rather than from strings in the design.
- Zest does the same in a small way: copy, benefit order and the highlighted plan come from `/v1/config` with bundled defaults, and prices always come from StoreKit.

## What Zest takes and refuses

Takes: the goal in the headline (YAZIO), the trial timeline (Cal AI) if a trial exists, one big honest close button, two plans with the yearly preselected and its monthly equivalent, the mascot on top.

Refuses, because it would be misleading or illegal in Germany (UWG § 5): invented discounts and struck-through prices, countdowns, "only 3 left", "lowest price ever", spin wheels, unsourced multipliers, stars and quotes that are not real.
