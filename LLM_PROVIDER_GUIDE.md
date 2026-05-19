# LLM Provider Configuration Guide

The Buzz Orchestrator supports multiple LLM providers through a provider-agnostic adapter system.

## Supported Providers

| Provider       | Environment Variable | Models Available                                                      |
| -------------- | -------------------- | --------------------------------------------------------------------- |
| **Anthropic**  | `ANTHROPIC_API_KEY`  | Claude 3.5 Sonnet, Claude 3.5 Haiku                                   |
| **NVIDIA NIM** | `NVIDIA_API_KEY`     | Kimi K2.5, Minimax m2.5, GLM 5, Qwen 3.5 397B, DeepSeek R1, Llama 3.3 |
| **OpenAI**     | `OPENAI_API_KEY`     | GPT-4o, GPT-4 Turbo, GPT-3.5                                          |
| **Kimi**       | `KIMI_API_KEY`       | Kimi K2.5                                                             |
| **Gemini**     | `GEMINI_API_KEY`     | Gemini Pro, Gemini Ultra                                              |
| **OpenRouter** | `OPENROUTER_API_KEY` | All models via OpenRouter                                             |

---

## Quick Setup

### Option 1: Auto-Detect (Recommended)

Just set the API key for your preferred provider. The orchestrator will auto-detect:

```bash
# For NVIDIA (any of these will work)
NVIDIA_API_KEY=nvapi-xxxxx

# For Anthropic
ANTHROPIC_API_KEY=sk-ant-xxxxx

# For OpenAI
OPENAI_API_KEY=sk-xxxxx
```

### Option 2: Explicit Provider

```bash
LLM_PROVIDER=nvidia
LLM_API_KEY=nvapi-xxxxx
SCORING_MODEL=meta/llama-3.3-70b-instruct
```

---

## NVIDIA NIM Configuration

### Get API Key

1. Go to [NVIDIA NIM](https://build.nvidia.com/)
2. Sign in and generate an API key
3. Keys start with `nvapi-`

### Available Models

```bash
# Kimi K2.5 - Best for long context reasoning
SCORING_MODEL=moonshotai/kimi-k2-5

# Minimax m2.5 - Fast and efficient
SCORING_MODEL=minimax/m2-5

# GLM 5 - Good for Chinese/multilingual
SCORING_MODEL=thudm/glm-5

# Qwen 3.5 397B - Largest model, best quality
SCORING_MODEL=qwen/qwen-3.5-397b

# DeepSeek R1 - Best for reasoning
SCORING_MODEL=deepseek-ai/deepseek-r1

# Llama 3.3 70B - Balanced performance
SCORING_MODEL=meta/llama-3.3-70b-instruct
```

### Full NVIDIA Configuration

```bash
# .env for orchestrator
LLM_PROVIDER=nvidia
NVIDIA_API_KEY=nvapi-xxxxx
SCORING_MODEL=meta/llama-3.3-70b-instruct
MODERATION_MODEL=meta/llama-3.2-3b-instruct

# Or use shorthand model names
SCORING_MODEL=llama-3.3-70b
```

---

## Environment Variables Reference

### Provider Selection

| Variable       | Description                | Default       |
| -------------- | -------------------------- | ------------- |
| `LLM_PROVIDER` | Explicit provider name     | Auto-detected |
| `LLM_API_KEY`  | Generic API key (fallback) | -             |
| `LLM_API_URL`  | Custom API endpoint        | -             |

### Model Selection

| Variable           | Description               | Default                      |
| ------------------ | ------------------------- | ---------------------------- |
| `SCORING_MODEL`    | Model for message scoring | `claude-3-5-sonnet-20241022` |
| `MODERATION_MODEL` | Model for moderation      | `claude-3-5-haiku-20241022`  |

### Provider-Specific Keys

| Variable             | Provider      | Format         |
| -------------------- | ------------- | -------------- |
| `ANTHROPIC_API_KEY`  | Anthropic     | `sk-ant-xxxxx` |
| `NVIDIA_API_KEY`     | NVIDIA NIM    | `nvapi-xxxxx`  |
| `OPENAI_API_KEY`     | OpenAI        | `sk-xxxxx`     |
| `KIMI_API_KEY`       | Kimi/Moonshot | `xxxxx`        |
| `GEMINI_API_KEY`     | Google Gemini | `xxxxx`        |
| `OPENROUTER_API_KEY` | OpenRouter    | `sk-or-xxxxx`  |

---

## Example Configurations

### Anthropic (Default)

```bash
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
SCORING_MODEL=claude-3-5-sonnet-20241022
MODERATION_MODEL=claude-3-5-haiku-20241022
```

### NVIDIA with Llama 3.3

```bash
LLM_PROVIDER=nvidia
NVIDIA_API_KEY=nvapi-xxxxx
SCORING_MODEL=meta/llama-3.3-70b-instruct
MODERATION_MODEL=meta/llama-3.2-3b-instruct
```

### NVIDIA with Qwen 3.5 397B

```bash
LLM_PROVIDER=nvidia
NVIDIA_API_KEY=nvapi-xxxxx
SCORING_MODEL=qwen/qwen-3.5-397b
```

### NVIDIA with Kimi K2.5

```bash
LLM_PROVIDER=nvidia
NVIDIA_API_KEY=nvapi-xxxxx
SCORING_MODEL=moonshotai/kimi-k2-5
```

### OpenAI

```bash
OPENAI_API_KEY=sk-xxxxx
SCORING_MODEL=gpt-4o
MODERATION_MODEL=gpt-4o-mini
```

### OpenRouter (Access to all models)

```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-xxxxx
SCORING_MODEL=anthropic/claude-3.5-sonnet
LLM_API_URL=https://openrouter.ai/api/v1/chat/completions
```

### Disabled (No LLM)

```bash
LLM_PROVIDER=none
```

---

## Model Recommendations

### For Scoring (Message Quality Assessment)

| Use Case         | Recommended Model | Why                              |
| ---------------- | ----------------- | -------------------------------- |
| **Best Quality** | Qwen 3.5 397B     | Largest model, best reasoning    |
| **Balanced**     | Llama 3.3 70B     | Good quality, fast               |
| **Fast & Cheap** | Llama 3.2 3B      | Quick responses                  |
| **Reasoning**    | DeepSeek R1       | Optimized for reasoning tasks    |
| **Long Context** | Kimi K2.5         | Excellent for long conversations |

### For Moderation (Safety & Compliance)

| Use Case           | Recommended Model |
| ------------------ | ----------------- |
| **Default**        | Llama 3.2 3B      |
| **Fast**           | Claude 3.5 Haiku  |
| **Cost-Effective** | GPT-4o Mini       |

---

## Cost Comparison (Approximate, per 1M tokens)

| Provider  | Model             | Input  | Output |
| --------- | ----------------- | ------ | ------ |
| NVIDIA    | Llama 3.3 70B     | $0.63  | $0.63  |
| NVIDIA    | Qwen 3.5 397B     | ~$2.00 | ~$2.00 |
| NVIDIA    | DeepSeek R1       | $0.55  | $2.19  |
| Anthropic | Claude 3.5 Sonnet | $3.00  | $15.00 |
| Anthropic | Claude 3.5 Haiku  | $0.80  | $4.00  |
| OpenAI    | GPT-4o            | $2.50  | $10.00 |
| OpenAI    | GPT-4o Mini       | $0.15  | $0.60  |

---

## Troubleshooting

### "No LLM provider configured"

Set one of the API key environment variables:

```bash
export NVIDIA_API_KEY=nvapi-xxxxx
# or
export ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### "NVIDIA API key required"

Make sure your key starts with `nvapi-`:

```bash
NVIDIA_API_KEY=nvapi-xxxxx  # Correct
NVIDIA_API_KEY=xxxxx        # Wrong format
```

### Model Not Found

Use the full model name:

```bash
# Correct
SCORING_MODEL=meta/llama-3.3-70b-instruct

# Wrong (shorthand not always supported)
SCORING_MODEL=llama-3.3-70b
```

### Rate Limiting

Add retry logic or use a smaller model:

```bash
# Use smaller model for moderation
MODERATION_MODEL=meta/llama-3.2-3b-instruct
```

---

## Adding Custom Providers

To add a new provider, create a file at:

```
orchestrator/src/services/providers/<provider>_provider.py
```

Example:

```python
# my_provider.py
class MyProvider:
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key

    def messages_create(self, model: str, messages: list, **kwargs):
        # Call your API
        response = call_my_api(model, messages, self.api_key)

        # Return object with .content[0].text
        class _Resp:
            def __init__(self, text):
                self.content = [type("o", (), {"text": text})]

        return _Resp(response.text)
```

Then set:

```bash
LLM_PROVIDER=my_provider
LLM_API_KEY=your_key
```
