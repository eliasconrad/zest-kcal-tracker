# Skills for agents working on Zest

Copies of the skill files Elias uses with Claude Code, so a Cursor Cloud Agent (or any agent) can read the same guidance. Each folder has a `SKILL.md` (or `AGENTS.md`) that explains when to use it. Read the one that fits before you build or review motion, design or React Native code:

| Folder | Use it for |
| --- | --- |
| `animate` | Building one animation from scratch: purpose, tool, properties, curve, duration, interruption, exit. |
| `review-animations` | Critiquing existing motion against a written standard (`STANDARDS.md`). |
| `improve-animations` | Auditing a whole codebase's motion and planning fixes (`AUDIT.md`, `PLAN-TEMPLATE.md`). |
| `find-animation-opportunities` | Finding places that should move and rejecting those that should not. |
| `animation-vocabulary` | Naming an effect precisely. |
| `apple-design` | Apple's interaction and material principles: springs, gestures, sheets, translucency, typography, Reduce Motion. |
| `emil-design-eng` | Emil Kowalski's rules for polish, component details, animation decisions. |
| `vercel-react-native-skills` | React Native performance and structure rules (lists, Reanimated, gestures, images, fonts). |
| `vercel-react-best-practices` | React correctness and performance rules. |

Sources: the `vercel-*` folders are from vercel-labs/agent-skills (MIT). The others are Elias's installed skill packs, copied for this private repository.
