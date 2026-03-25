# FlightWrapped LLM Evals

Comprehensive evaluation suite for the flight extraction LLM pipeline. Uses [promptfoo](https://promptfoo.dev) to test extraction accuracy against ground truth datasets, running locally via [Ollama](https://ollama.com).

## Prerequisites

1. **Node.js 18+** (already required by FlightWrapped)
2. **Ollama** installed and running:
   ```bash
   # Install: https://ollama.com
   ollama serve
   ```
3. **Llama 3.2 3B** model pulled:
   ```bash
   ollama pull llama3.2:3b
   ```

## Quick Start

```bash
# From project root
cd evals

# Run single-email extraction evals
npx promptfoo eval

# View HTML report
npx promptfoo view

# Run batch extraction evals
npx promptfoo eval -c promptfooconfig.batch.yaml

# Or use the convenience script
./scripts/run-evals.sh --all
```

## Directory Structure

```
evals/
├── promptfooconfig.yaml          # Main config (single-email evals)
├── promptfooconfig.batch.yaml    # Batch extraction config
├── prompts/
│   ├── single-extract.txt        # Single-email prompt template
│   └── batch-extract.txt         # Batch (3-email) prompt template
├── datasets/
│   ├── single-flight.yaml        # 10 cases: one flight per email
│   ├── multi-flight.yaml         # 8 cases: round trips, connections
│   ├── no-flight.yaml            # 8 cases: no actual flights
│   ├── edge-cases.yaml           # 8 cases: dates, languages, noise
│   ├── airline-formats.yaml      # 8 cases: different email formats
│   └── batch-extraction.yaml     # 4 cases: 3-email batch extraction
├── assertions/
│   ├── flight-assertions.mjs     # Custom assertion: ground truth check
│   └── batch-assertions.mjs      # Custom assertion: batch ground truth
├── scripts/
│   └── run-evals.sh              # Convenience runner script
├── output/                       # Generated results (gitignored)
└── README.md                     # This file
```

## Eval Categories

| Category | File | Cases | What It Tests |
|----------|------|-------|---------------|
| Single Flight | `single-flight.yaml` | 10 | One flight per email, diverse airlines |
| Multi-Flight | `multi-flight.yaml` | 8 | Round trips, connections, multi-city |
| No Flight | `no-flight.yaml` | 8 | Emails that should return empty flights |
| Edge Cases | `edge-cases.yaml` | 8 | Date formats, languages, noise |
| Airline Formats | `airline-formats.yaml` | 8 | Different email layout styles |
| Batch Extraction | `batch-extraction.yaml` | 4 | 3-email batch processing |

**Total: ~46 eval cases** across 6 dataset files.

## Assertions

Every test case is checked against these assertions:

1. **Valid JSON** - Output must parse as JSON
2. **Schema compliance** - Must have a `flights` array
3. **IATA validity** - All airport codes must be 3-letter uppercase
4. **Date format** - All dates must be `YYYY-MM-DD`
5. **Ground truth accuracy** - Precision and recall vs expected flights (threshold: 0.8)

## Scoring

- **Precision**: `true_positives / total_extracted` (penalizes hallucinated flights)
- **Recall**: `true_positives / ground_truth_count` (penalizes missed flights)
- **F1 Score**: `2 * precision * recall / (precision + recall)` (overall score)
- **Field Accuracy**: Per-field checks for airline name and flight number

Flights are matched by `origin + destination + date` (same logic as production dedup).

## Configuring a Different Model

Edit `promptfooconfig.yaml` to use a different Ollama model:

```yaml
providers:
  - id: ollama:chat:llama3.1:8b    # or any model in `ollama list`
    label: llama3.1-8b
    config:
      temperature: 0.1
      max_tokens: 500
```

You can also test multiple models side-by-side by listing several providers.

## Interpreting Results

After running `npx promptfoo view`, the HTML report shows:

- **Pass/Fail** per test case and assertion
- **Score** (0-1) based on F1 accuracy
- **Side-by-side comparison** when testing multiple models
- **Failure reasons** with details on what went wrong

Look for patterns in failures:
- Low precision → model hallucinating flights that don't exist
- Low recall → model missing flights present in the email
- IATA failures → model inventing airport codes
- Date failures → model using wrong date format

## Adding New Test Cases

Add a new entry to any dataset YAML file:

```yaml
- vars:
    email_text: |
      Subject: Your Flight Confirmation
      ... email content ...
    ground_truth: '{"flights":[{"origin":"JFK","destination":"LAX","date":"2024-06-15","airline":"Delta","flightNumber":"DL 456"}]}'
  assert: []
```

The `assert: []` is required but left empty — assertions are defined globally in `promptfooconfig.yaml`.

## CI Integration

To run evals in CI (requires Ollama in the CI environment):

```bash
cd evals && npx promptfoo eval --output output/ci-results.json
# Check exit code: 0 = all pass, 1 = failures
```
