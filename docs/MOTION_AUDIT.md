# Motion audit (October 30, 2026)

Audit of every animation under `src/cookbooks/zest`, using `agent-skills/improve-animations`, `animate` and `apple-design`. The reference timings are the frame measurements of YAZIO, BitePal and Duolingo already recorded in `MOTION_SPEC.md`. No new recordings were measured in this round. The mascot's and the streak's timings were not touched.

| Where | Before | Finding | Now |
| --- | --- | --- | --- |
| Choices, chips, tags, meal chips, plan cards, recipe filters | Colour snapped | State change with no continuity | `Selectable`: 160 ms strong ease-out, reverses when tapped again |
| Check mark on a choice | Popped in | Same | 120 ms fade |
| Continue button | Opacity snapped | Same | 220 ms between dim and ready |
| Progress line | Jumped | Spatial change without motion | 320 ms layout transition |
| Question content | Slid in, cut out | Exit missing | 120 ms fade out, the entrance stays at the measured 280 ms |
| Sheets over sheets | Text of both visible | Bug: glass is see-through | Content under it fades in 160 ms |
| New sheets | | | Open on the profile's spring (damping 26, stiffness 180), close with a 240 ms slide |
| Photo menu | Appeared | Trigger-anchored element with no entrance | 160 ms rise and fade from the composer |
| Receipt number | Appeared | The payoff moment had no weight | Counts up from 60 % over 420 ms on the UI thread |
| Recipe rows | | | 220 ms fade with a 30 ms stagger, first 8 rows only and only on first appearance |
| Press feedback | 0.97 spring | Fine | Unchanged |
| Haptics | At commits | Fine | Unchanged |

Left out on purpose: pull-to-refresh, because nothing on these sheets needs a manual refresh; overscroll, because iOS already rubber-bands every scroll view. Every new effect is removed under Reduce Motion.

Not yet judged on a device: frame rate of the count-up and of stacked glass during the slide.
