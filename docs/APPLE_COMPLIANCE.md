# Apple compliance (October 30, 2026)

Checked against the App Store Review Guidelines and the Human Interface Guidelines. "Done" means in code; a device check is listed where only a device can prove it.

| Rule | Status | Where |
| --- | --- | --- |
| 1.4.1 Health: no medical claims, estimates labelled | Done | plan step and profile copy, `legal.ts` terms |
| 3.1.1 In-app purchase for digital goods | Done, needs products in App Store Connect | `data/purchases.ts` (StoreKit 2 via expo-iap) |
| 3.1.2 Subscription terms on the paywall: price, period, auto-renewal, how to cancel, Terms, Privacy, Restore | Done | `components/Paywall.tsx` |
| 3.1.2 No trial wording unless the store offers one | Done | `trialDays` comes from StoreKit |
| 4.8 Sign in with Apple beside e-mail | Done, needs the capability on the App ID | `components/AccountSheet.tsx`, `server/src/auth.ts` |
| 5.1.1(i) Privacy policy linked in the app and the listing | Page exists as a **draft**; operator name and address missing | `server/src/legal.ts`, also needs the App Store Connect field |
| 5.1.1(ii) Purpose strings: camera, photos | Done | `app.json` |
| 5.1.1(v) Account deletion inside the app | Done, removes every server row (tested) | Profile, Manage, Delete account; `/v1/auth/delete` |
| 5.1.1 Data minimisation: the diary works without an account | Done | guest session, account step can be skipped |
| 5.1.2 Sharing data with third parties disclosed | In the policy draft; the upload to the model provider needs in-app consent wording before the first scan | see open points |
| Privacy manifest: required-reason APIs, collected data, no tracking | Done, the reasons must be checked against the final build's report | `app.json` `ios.privacyManifests` |
| Age: 16+ (GDPR consent age in Germany) | Done | `limits.birthYear` |
| HIG: Dynamic Type | Partly; new sheets scroll and use system text, not checked at the largest sizes | needs a device check |
| HIG: VoiceOver labels on every control | Done on new screens; flows tap by label | |
| HIG: Reduce Motion and Reduce Transparency | Done | `scene.reduced`, `useReducedMotion`, `useNativeGlass` |
| HIG: safe areas, keyboard avoidance | Sheets use the shared geometry; the keyboard over the account sheet's lower fields needs a device check | |
| Identity: no template names left | Done: slug `zest`, scheme `zest`, bundle id `eu.eliasconrad.zest` | `app.json` |

## Needs Elias

1. Register `eu.eliasconrad.zest` with the Sign in with Apple and In-App Purchase capabilities.
2. Create the app in App Store Connect and the two subscriptions, decide the prices and any trial (`docs/PRICING.md`).
3. Add the operator's name and address to `server/src/legal.ts`, have the text reviewed, deploy, and enter the URLs in App Store Connect.
4. Set the App Store Server Notifications URL to `https://zest-api.hallo-e53.workers.dev/v1/appstore/notifications`.
5. Set the Worker's secrets (`OPENROUTER_API_KEY`, `ZEST_APP_TOKEN`, `RESEND_API_KEY`) and top up OpenRouter.
6. Create an Expo project (`eas init`) so friend nudges can use Expo Push; without it nudges stay off.
7. Fill the App Privacy questionnaire to match the manifest. Screenshots, age rating and review notes with a test account.

## Open point worth deciding

Sending a photo to the model provider goes to a third party. Apple's 5.1.2 and the GDPR expect clear consent. The privacy page says so, but a one-line notice before the first scan is still missing.
