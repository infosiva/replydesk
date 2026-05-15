# NVidia NIM + Kimi MCP & Fallback Chain Expansion

**Date:** 2026-05-09  
**Status:** Approved for implementation

---

## Goal

Extend the universal AI fallback chain with two new free providers (NVidia NIM, Kimi/Moonshot) and deploy an MCP server on VPS so Claude Code sessions and all VPS agents can delegate inference tasks without touching paid providers.

---

## Fallback Chain (updated)

```
1. Ollama        local, 100% free — gemma4 → qwen3.6 → llama3.2
2. Groq          cloud free tier  — multi-key rotation
3. Gemini        cloud free tier  — multi-key rotation
4. Cerebras      cloud free tier
5. NVidia NIM    cloud free tier  — NEW (integrate.api.nvidia.com/v1)
6. Kimi          cloud free tier  — NEW (api.moonshot.cn/v1)
7. OpenAI        paid ($5 credit)
8. Anthropic     paid, last resort
```

Both new providers use existing `callOpenAICompat` + `callProvider` — zero new fetch logic.

---

## Model Tiers

### NVidia NIM (`DEFAULT_NVIDIA_TIERS`)
| Quality | Models |
|---------|--------|
| fast | `microsoft/phi-4-mini-instruct` (3.8B, lowest latency) |
| balanced | `qwen/qwen2.5-72b-instruct` (72B, quality/speed sweet spot) |
| best | `meta/llama-3.1-405b-instruct`, `mistralai/mistral-large-2-instruct` |

### Kimi/Moonshot (`DEFAULT_KIMI_TIERS`)
| Quality | Models |
|---------|--------|
| fast | `moonshot-v1-8k` |
| balanced | `moonshot-v1-32k` |
| best | `moonshot-v1-128k` (differentiator: huge context window) |

All tiers overridable via Edge Config keys `nvidia_tiers` and `kimi_tiers` — zero-redeploy model swaps.

---

## Changes to `ai-platform-template/lib/ai.ts`

1. Add `DEFAULT_NVIDIA_TIERS` and `DEFAULT_KIMI_TIERS` constants
2. Extend `_edgeConfig` type with `nvidia_tiers` and `kimi_tiers`
3. Extend `getTiers()` to include nvidia + kimi
4. Add two new provider entries in `callAI` providers array (after cerebras, before openai)
5. Update header comment to reflect new chain
6. Propagate to all 15 projects

**No new functions.** Both providers reuse `callProvider` with their base URLs.

---

## Key Rotation Convention (updated)

```
NVIDIA_API_KEY, NVIDIA_API_KEY_1, ...   (free: build.nvidia.com)
KIMI_API_KEY, KIMI_API_KEY_1, ...       (free: platform.moonshot.cn)
```

Add to `.env.example` and `set-vercel-env.ts` propagation script.

---

## MCP Server (VPS)

**Location:** `/root/nvidia-mcp/` on VPS (31.97.56.148)  
**Runtime:** Node/TS, compiled to JS, run via PM2  
**Protocol:** stdio MCP (same pattern as Hermes)  

### Tools exposed
| Tool | Description |
|------|-------------|
| `nvidia_chat` | Single-turn inference via NVidia NIM |
| `nvidia_complete` | Text completion, quality tier selectable |
| `kimi_chat` | Long-context inference via Kimi (up to 128k) |

### Wired in `~/.claude/settings.json`
```json
{
  "mcpServers": {
    "nvidia-mcp": {
      "command": "ssh",
      "args": [
        "root@31.97.56.148",
        "NVIDIA_API_KEY=$NVIDIA_API_KEY KIMI_API_KEY=$KIMI_API_KEY node /root/nvidia-mcp/dist/index.js"
      ]
    }
  }
}
```

### PM2 process
Not a persistent daemon — invoked on-demand by Claude Code via SSH stdio. No PM2 entry needed.

---

## Propagation Plan

1. Update `ai-platform-template/lib/ai.ts` (canonical)
2. Copy to all 15 project paths (same copy pattern as 2026-05-05 upgrade)
3. Add `NVIDIA_API_KEY` + `KIMI_API_KEY` to Edge Config
4. Update `set-vercel-env.ts` to sync new keys to all Vercel projects
5. Build MCP server at `/root/nvidia-mcp/`
6. Wire MCP into `~/.claude/settings.json`

---

## Out of Scope

- Stitch → MCP design pipeline (separate spec)
- Hermes scope automation (separate spec)
- Streaming responses (existing chain is non-streaming, keep consistent)
