#!/usr/bin/env bash
# Run FlightWrapped LLM evals and open the HTML report.
#
# Usage:
#   ./evals/scripts/run-evals.sh              # run single-email evals
#   ./evals/scripts/run-evals.sh --batch      # run batch evals
#   ./evals/scripts/run-evals.sh --all        # run both
#   ./evals/scripts/run-evals.sh --no-view    # run without opening report

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EVALS_DIR="$(dirname "$SCRIPT_DIR")"
cd "$EVALS_DIR"

# Defaults
RUN_SINGLE=true
RUN_BATCH=false
OPEN_VIEW=true

for arg in "$@"; do
  case "$arg" in
    --batch)   RUN_SINGLE=false; RUN_BATCH=true ;;
    --all)     RUN_SINGLE=true;  RUN_BATCH=true ;;
    --no-view) OPEN_VIEW=false ;;
    --help|-h)
      echo "Usage: $0 [--batch] [--all] [--no-view]"
      echo ""
      echo "  (default)   Run single-email extraction evals"
      echo "  --batch     Run batch extraction evals only"
      echo "  --all       Run both single and batch evals"
      echo "  --no-view   Skip opening HTML report"
      exit 0
      ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

# Check Ollama is running
if ! command -v ollama &>/dev/null; then
  echo "Error: ollama not found. Install from https://ollama.com"
  exit 1
fi

if ! ollama list &>/dev/null; then
  echo "Error: Ollama is not running. Start it with: ollama serve"
  exit 1
fi

# Check model is available
if ! ollama list | grep -qE "llama3.2:3b|llama3.2:latest"; then
  echo "Warning: llama3.2:3b not found. Pulling it now..."
  ollama pull llama3.2:3b
fi

mkdir -p output

TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "============================================"
echo " FlightWrapped LLM Evals"
echo " $(date)"
echo "============================================"
echo ""

if [ "$RUN_SINGLE" = true ]; then
  echo ">>> Running single-email extraction evals..."
  npx promptfoo eval --output "output/single-${TIMESTAMP}.json"
  echo ""
  echo "Results saved to: output/single-${TIMESTAMP}.json"
  echo ""
fi

if [ "$RUN_BATCH" = true ]; then
  echo ">>> Running batch extraction evals..."
  npx promptfoo eval -c promptfooconfig.batch.yaml --output "output/batch-${TIMESTAMP}.json"
  echo ""
  echo "Results saved to: output/batch-${TIMESTAMP}.json"
  echo ""
fi

echo "============================================"
echo " Evals complete!"
echo "============================================"

if [ "$OPEN_VIEW" = true ]; then
  echo ""
  echo "Opening HTML report viewer..."
  npx promptfoo view
fi
