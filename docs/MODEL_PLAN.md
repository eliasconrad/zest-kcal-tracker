# Model plan

Date: 30 October 2026. No fine-tune was started. No OpenRouter key was available in this environment, so the comparison numbers below were not measured.

## What runs today

`server/wrangler.jsonc` sets `OPENROUTER_MODEL` to `qwen/qwen2.5-vl-72b-instruct` and `OPENROUTER_BASE_URL` to `https://openrouter.ai/api/v1`. OpenRouter does not fine-tune models. The Worker only changes the base URL and the model id when a self-hosted endpoint replaces it.

Prompt changes that are already in `server/src/prompts.ts`: seven wire-format examples (common plates, a portion in grams, plate or cutlery as scale, and an explicit `Unknown | ? | ? | ? | ?` line). `server/src/calibrate.ts` then checks meal-type bounds, 4/4/9 consistency, and a twenty-food portion table. `/v1/ask` receives the onboarding profile and is told to use that person’s guide and targets.

The harness is `server/scripts/eval/run.mjs`. It posts the three bundled sample meals and prints mean absolute error for kilocalories and each macro, plus the share of replies that parse on the first try. Without `ZEST_API_URL` it checks that the photos exist and exits without inventing an error.

## Comparison to run when a key exists

Point a deployed or local Worker at one model at a time, then:

```bash
cd server
ZEST_API_URL=https://<worker-host> ZEST_APP_TOKEN=<token> node scripts/eval/run.mjs
```

Models to record, all with image input, swapping `OPENROUTER_MODEL`:

| Model id | Role |
| --- | --- |
| `qwen/qwen2.5-vl-72b-instruct` | Current default |
| `meta-llama/llama-4-scout` | Llama 4 vision |
| `google/gemma-3-27b-it` | Gemma 3 vision |

For each, write the harness JSON, the date, and the OpenRouter price per 1,000 scans (input image tokens plus the short completion). Those prices were not copied here, because they were not read from the provider in this session.

## Fine-tune, if Elias decides to do it

Candidate: **Qwen2.5-VL-7B** with LoRA. The 72B model is the quality reference; 7B is the size that can be trained and served on a single GPU.

Host: any GPU provider that exposes an OpenAI-compatible `/chat/completions` endpoint. The Worker then changes only `OPENROUTER_BASE_URL` and `OPENROUTER_MODEL`.

Data: photos with a weighed ground truth (name, grams, kilocalories, protein, carbs, fat), at least a few thousand, covering the meal types Zest logs. The three bundled plates are a harness fixture, not training data. A larger licensed set such as Nutrition5k (CC-BY) was not downloaded here; see `docs/DEPENDENCIES.md`.

Cost: not estimated from a quote. A LoRA on a 7B vision model is typically a few hundred dollars of GPU time for a short run, plus ongoing serving. Get a current price from the chosen host before starting.

Gate: the Task 1 harness. Keep a candidate only when its mean absolute error in kilocalories and the first-try parse rate are both better than the current prompt-plus-calibration path on the same labelled set.
