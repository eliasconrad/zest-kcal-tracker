# Verification

This file records the standalone project checks, separate from the original chat collection's historical QA.

Validated October 6, 2026 with a bundled Release build in a fresh isolated iPhone 17 Pro simulator running iOS 27.0, built with Xcode 27.0. The installed binary declares `iphonesimulator27.0`, Xcode 27, and `EXExpoAppSceneDelegate` scene support. The app opens without Metro or any service. Device layout is 402 × 874 points; direct captures are 1206 × 2622 pixels. Raw evidence stays under ignored `.qa/`.

## Automated checks

| Check | Result |
| --- | --- |
| Independent `npm ci` | Passed with the project's own lockfile and dependencies. |
| Strict TypeScript and Expo ESLint | Passed. |
| Node regression suite | 33 passing checks (October 30, 2026: clock-based camera meal default, e-mail check, e-mail persistence added) (October 29, 2026: streaming reply parsing, diary context, nutrition math, profile persistence added): local dates/leap years, totals, partial protein, supportive guide answers, sample identity, reactions, duplicate confirmation, edit/delete/persistence, storage isolation, actual router parser, malformed URI handling, native-tool UUIDs, assets, routes and documentation links. |
| `npx expo-doctor` | 21/21 checks passed. |
| iOS JavaScript export | Passed; all bundled food artwork resolves. |
| Real model round trip | October 29, 2026: a bundled sample photo sent through the local Worker to OpenRouter (qwen/qwen2.5-vl-72b-instruct) streamed `Avocado toast eggs \| 450 \| 20 \| 30 \| 25` plus a note; the reply opened with a blank line, which `parseEstimate` now skips (covered by a test). An open question streamed a three-sentence answer with three follow-ups. |
| Native Release build | Passed, zero errors and one native build-script warning. Built directly from a checkout whose parent path contains spaces. |
| Shipped Maestro flows | October 29, 2026, Xcode 26.6 / iOS 26.4 simulator: `diary.yaml` passed (sample camera retake, dinner receipt, protein, calendar navigation, close, retained diary after a new chat; now starting from the onboarding sheet and skipping it via the showcase link). `onboarding.yaml` passed (1 min 56 s, after the measured mascot timings; re-run after the hidden-start reveal with the drawn-frame gate: both flows 3 min 28 s; the bubble follows the title by 2.4 s in Maestro's own timestamps; the last step is confirmed with `longPressOn`, the hold-to-commit button; the flow then logs the first meal of the day and asserts the streak celebration, its week strip and the return to the receipt; both flows 4 min 3 s on the dedicated `Zest iPhone 17 Pro` simulator in en_US): name with the lemon's greeting bubble, the 1.3 s greeting interlude, goal, body with the keyboard toolbar, target, activity, pace, the four-item "working it out" computation (6.4 s), the computed guide with sparkles, the profile sheet with ring and progress, close, and the profile surviving a relaunch. Both flows together: 3 min 17 s. |
| npm security audit | Not clean: 20 high-severity affected entries from two unpatched transitive tooling advisories. See [dependency notes](DEPENDENCIES.md). |

## Native interaction results

Direct IDB input passed: one mascot and no root back action; camera focus/review/retake/cancel; exactly one sample dinner; a fully visible 70 g protein answer; invalid calorie edit rejection and valid edit updating the total; guide changes and the above-guide expression; month navigation; deletion; native photo-picker cancel; and persisted diary/guide after app termination. The complete result is retained locally in `.qa/native/native-results.json`.

The [keyboard preview](images/keyboard.png) also records the native composer clearance. The README images are fresh direct captures of this standalone build. Its native glass, stable photo identity, sticker/receipt alignment, calendar, and open-keyboard 12-point composer clearance were reviewed visually. The raw images and normal-speed recordings remain under `.qa/`.

The [23-second walkthrough](images/walkthrough.mp4) shows real native input through sample capture, dinner confirmation, month navigation, and a protein question after closing the calendar. The completed answer was asserted in the native accessibility tree. Its export keeps the original 1206 × 2622 resolution and normal playback speed at 60 fps; this encoding rate is not a physical-device performance measurement.

## Reproduce

```bash
npm ci
npm run verify
npx expo-doctor
npx expo export --platform ios
npx expo run:ios --configuration Release --device <simulator-udid>
SIMULATOR_UDID=<booted-device> npm run test:ios
```

Use a simulator of your own in `en_US`: a shared one may be driven by another session, and the deep-link confirmation and keyboard are localized.

Maestro needs a Java 17+ runtime on PATH (for example `brew install openjdk@21` and `export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"`). `maestro` itself can live in `~/.maestro/bin`.

After a Maestro XCTest run or native reinstall, restart the dedicated simulator and IDB companion if IDB returns an empty accessibility tree. This resets the test service, not the diary.

The Maestro test clears only this application's data, seeds the explicit sample diary, and exercises camera retake/use, dinner confirmation, protein, month navigation and diary continuity after a new conversation. Use a dedicated simulator. The URI decoder regression uses the actual installed Expo Router parser, including malformed input, rather than a mock parser.

The additional IDB regression targets the verified iPhone 17 Pro geometry and checks editor/guide validation, native photo-picker cancellation, and persistence. Its fallback coordinates work around cached UIKit accessibility transforms following full-screen modals; they are not app layout coordinates to reuse on other devices.

```bash
python3 -m venv .qa/venv
.qa/venv/bin/pip install -r scripts/requirements-native.txt
idb_companion --udid <device-id> --grpc-port 11021
# In another terminal:
SIMULATOR_UDID=<device-id> .qa/venv/bin/python scripts/verify-native.py
```

Maestro is the default; IDB is optional. Both native scripts were verified on iPhone 17 Pro. The Maestro close action also uses a documented top-right percentage target because the hosted SwiftUI accessibility frame can remain offscreen after its entry animation. Both use real native input. Neither is a substitute for visual review of glass or motion.

## Limits

This is a UI template with local fixture answers. Android/web, a nutrition model or backend, hardware camera/sensors/haptics, and physical-device frame-rate measurement are not verified. CI performs install, TypeScript, lint, regression checks, and iOS JavaScript export; native builds and motion review run separately on macOS. Live workflow results are available in the repository's [Actions tab](https://github.com/Appllama/zest-kcal-tracker/actions).
