# LLM Providers

This document explains how to configure the Orchestrator to use different LLM providers.

Environment (preferred)

- `LLM_PROVIDER` — optional provider name (e.g. `anthropic`, `openai`, `openrouter`, `nvidia`, `kimi`, `gemini`, `none`). If omitted, the system will attempt to auto-detect from provider-specific env vars.
- `LLM_API_KEY` — generic API key used by many providers.
- Provider-specific env vars supported for auto-detection:
  - `GEMINI_API_KEY`
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `OPENROUTER_API_KEY`
  - `NVIDIA_API_KEY`
  - `KIMI_API_KEY`
- `LLM_API_URL` — optional HTTP endpoint for generic HTTP provider (e.g. OpenRouter or self-hosted proxy).

Provider adapters

- Add a new adapter module at `orchestrator/src/services/providers/<provider>_provider.py` exposing `<ProviderName>Provider` or `get_provider(api_key)`.
- Adapters are lazy-imported to avoid adding all SDKs to the base image.

Generic HTTP provider

- Set `LLM_API_URL` to forward requests to any HTTP-compatible endpoint. The system includes a `GenericHTTPProvider` adapter that normalizes responses to the shape expected by the scoring engine.

Degraded / local development

- To run without an LLM, set `LLM_PROVIDER=none`. The orchestrator will start but scoring calls will raise and the scoring engine will fallback to a graceful fallback score (configurable).

Deployment recommendations

- Keep the base container small by only installing SDKs required by your chosen provider.
- Create provider-specific requirement files (e.g. `requirements-openai.txt`) and include them in your deployment pipeline when needed.

Security

- Never commit API keys to source control. Use Railway / cloud environment secret storage to set `LLM_API_KEY` or provider-specific keys.

Examples

- Anthropic (existing):
  - `LLM_PROVIDER=anthropic`
  - `ANTHROPIC_API_KEY=sk-...` or `LLM_API_KEY=sk-...`

- OpenAI:
  - `LLM_PROVIDER=openai`
  - `OPENAI_API_KEY=sk-...`

- Generic HTTP (OpenRouter):
  - `LLM_API_URL=https://api.openrouter.ai/v1/chat/completions`
  - `LLM_API_KEY=...` (and optionally `LLM_PROVIDER=openrouter`)
