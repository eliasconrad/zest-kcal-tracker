#!/usr/bin/env bash
# Scores the cheap open vision models against the current one on the same 30 weighed
# dishes. Needs OpenRouter credit; the whole run costs well under a dollar.
set -uo pipefail
cd "$(dirname "$0")/../.."
for model in \
  qwen/qwen2.5-vl-72b-instruct \
  google/gemma-4-26b-a4b-it \
  mistralai/mistral-small-3.2-24b-instruct \
  meta-llama/llama-4-scout \
  qwen/qwen3.5-9b \
  qwen/qwen3-vl-8b-instruct; do
  node --experimental-strip-types scripts/eval/run.mjs --model "$model" --prompt tuned --limit 30 --concurrency 2 --tag compare 2>/dev/null | tail -1
done
