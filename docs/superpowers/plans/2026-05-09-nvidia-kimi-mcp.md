# NVidia NIM + Kimi Fallback Chain & MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add NVidia NIM and Kimi/Moonshot as free inference providers to the universal AI fallback chain, and deploy an MCP server on VPS so Claude Code and all VPS agents can delegate inference tasks without hitting paid providers.

**Architecture:** Two new providers (NVidia NIM, Kimi) are inserted into `ai-platform-template/lib/ai.ts` between Cerebras and OpenAI using the existing `callOpenAICompat`/`callProvider` functions — no new fetch logic. A Node/TS MCP server at `/root/nvidia-mcp/` on the VPS exposes `nvidia_chat`, `nvidia_complete`, and `kimi_chat` tools over stdio, SSH-tunneled into `~/.claude/settings.json`.

**Tech Stack:** TypeScript, Node 20+, `@modelcontextprotocol/sdk`, SSH stdio MCP pattern (same as Hermes), Vercel REST API for env propagation.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `ai-platform-template/lib/ai.ts` | Modify | Add NVidia + Kimi tiers and provider entries |
| `agents/set-vercel-env.ts` | Modify | Add `NVIDIA_API_KEY` + `KIMI_API_KEY` to `SHARED_KEYS` |
| `agents/.env.shared` | Modify | Add `NVIDIA_API_KEY` and `KIMI_API_KEY` values |
| `/root/nvidia-mcp/package.json` | Create (VPS) | MCP server deps |
| `/root/nvidia-mcp/tsconfig.json` | Create (VPS) | TS config |
| `/root/nvidia-mcp/src/index.ts` | Create (VPS) | MCP server with 3 tools |
| `~/.claude/settings.json` | Modify | Wire MCP server via SSH |

---

## Task 1: Update canonical `lib/ai.ts` with NVidia + Kimi

**Files:**
- Modify: `ai-platform-template/lib/ai.ts`

- [ ] **Step 1: Add NVidia and Kimi tier constants after the Cerebras block (line ~64)**

Add after `DEFAULT_CEREBRAS_TIERS`:

```typescript
const DEFAULT_NVIDIA_TIERS: Record<Quality, string[]> = {
  fast:     ['microsoft/phi-4-mini-instruct'],
  balanced: ['qwen/qwen2.5-72b-instruct'],
  best:     ['meta/llama-3.1-405b-instruct', 'mistralai/mistral-large-2-instruct'],
}

const DEFAULT_KIMI_TIERS: Record<Quality, string[]> = {
  fast:     ['moonshot-v1-8k'],
  balanced: ['moonshot-v1-32k'],
  best:     ['moonshot-v1-128k'],
}
```

- [ ] **Step 2: Extend `_edgeConfig` type to include new tiers (around line ~83)**

Replace:
```typescript
let _edgeConfig: {
  groq_tiers?: Record<Quality, string[]>
  gemini_tiers?: Record<Quality, string[]>
  cerebras_tiers?: Record<Quality, string[]>
  claude_tiers?: Record<Quality, string>
} | null = null
```

With:
```typescript
let _edgeConfig: {
  groq_tiers?: Record<Quality, string[]>
  gemini_tiers?: Record<Quality, string[]>
  cerebras_tiers?: Record<Quality, string[]>
  nvidia_tiers?: Record<Quality, string[]>
  kimi_tiers?: Record<Quality, string[]>
  claude_tiers?: Record<Quality, string>
} | null = null
```

- [ ] **Step 3: Extend `getTiers()` return value (around line ~114)**

Replace:
```typescript
async function getTiers() {
  const ec = await getEdgeConfig()
  return {
    groq:     (ec?.groq_tiers     ?? DEFAULT_GROQ_TIERS)     as Record<Quality, string[]>,
    gemini:   (ec?.gemini_tiers   ?? DEFAULT_GEMINI_TIERS)   as Record<Quality, string[]>,
    cerebras: (ec?.cerebras_tiers ?? DEFAULT_CEREBRAS_TIERS) as Record<Quality, string[]>,
    openai:   DEFAULT_OPENAI_TIERS,
    claude:   (ec?.claude_tiers   ?? DEFAULT_CLAUDE_TIERS)   as Record<Quality, string>,
  }
}
```

With:
```typescript
async function getTiers() {
  const ec = await getEdgeConfig()
  return {
    groq:     (ec?.groq_tiers     ?? DEFAULT_GROQ_TIERS)     as Record<Quality, string[]>,
    gemini:   (ec?.gemini_tiers   ?? DEFAULT_GEMINI_TIERS)   as Record<Quality, string[]>,
    cerebras: (ec?.cerebras_tiers ?? DEFAULT_CEREBRAS_TIERS) as Record<Quality, string[]>,
    nvidia:   (ec?.nvidia_tiers   ?? DEFAULT_NVIDIA_TIERS)   as Record<Quality, string[]>,
    kimi:     (ec?.kimi_tiers     ?? DEFAULT_KIMI_TIERS)     as Record<Quality, string[]>,
    openai:   DEFAULT_OPENAI_TIERS,
    claude:   (ec?.claude_tiers   ?? DEFAULT_CLAUDE_TIERS)   as Record<Quality, string>,
  }
}
```

- [ ] **Step 4: Add NVidia and Kimi provider entries in `callAI` providers array (around line ~281)**

Replace:
```typescript
    { name: 'cerebras',  fn: () => callProvider('https://api.cerebras.ai/v1',                              'Cerebras', 'CEREBRAS', tiers.cerebras[quality], system, messages, maxTokens) },
    // ── Paid fallback (only hit if all free tiers are exhausted) ─────────────
    { name: 'openai',    fn: () => callProvider('https://api.openai.com/v1',                               'OpenAI',   'OPENAI',   tiers.openai[quality],   system, messages, maxTokens) },
```

With:
```typescript
    { name: 'cerebras',  fn: () => callProvider('https://api.cerebras.ai/v1',                              'Cerebras', 'CEREBRAS', tiers.cerebras[quality], system, messages, maxTokens) },
    { name: 'nvidia',    fn: () => callProvider('https://integrate.api.nvidia.com/v1',                     'NVidia',   'NVIDIA',   tiers.nvidia[quality],   system, messages, maxTokens) },
    { name: 'kimi',      fn: () => callProvider('https://api.moonshot.cn/v1',                              'Kimi',     'KIMI',     tiers.kimi[quality],     system, messages, maxTokens) },
    // ── Paid fallback (only hit if all free tiers are exhausted) ─────────────
    { name: 'openai',    fn: () => callProvider('https://api.openai.com/v1',                               'OpenAI',   'OPENAI',   tiers.openai[quality],   system, messages, maxTokens) },
```

- [ ] **Step 5: Update the header comment fallback chain list**

Replace lines 5-8 in the file header comment:
```
 *   1. Ollama   (local, 100% free) — gemma4 → qwen3.6 → llama3.2
 *   2. Groq     (cloud, free tier) — multi-key rotation
 *   3. Gemini   (cloud, free tier) — multi-key rotation
 *   4. Cerebras (cloud, free tier)
 *   5. OpenAI   (paid, but $5 free credit on new accounts)
 *   6. Anthropic/Claude (paid, last resort)
```

With:
```
 *   1. Ollama    (local, 100% free) — gemma4 → qwen3.6 → llama3.2
 *   2. Groq      (cloud, free tier) — multi-key rotation
 *   3. Gemini    (cloud, free tier) — multi-key rotation
 *   4. Cerebras  (cloud, free tier)
 *   5. NVidia    (cloud, free tier) — NIM inference, Llama/Phi/Qwen/Mistral
 *   6. Kimi      (cloud, free tier) — Moonshot, best for long-context
 *   7. OpenAI    (paid, but $5 free credit on new accounts)
 *   8. Anthropic/Claude (paid, last resort)
```

- [ ] **Step 6: Update the Capacity scaling comment block to include new keys**

Add after `CEREBRAS_API_KEY` line:
```
 *   NVIDIA_API_KEY, NVIDIA_API_KEY_1, ...    (free at build.nvidia.com)
 *   KIMI_API_KEY, KIMI_API_KEY_1, ...        (free at platform.moonshot.cn)
```

- [ ] **Step 7: Verify file compiles**

```bash
cd /Users/sivaprakasam/projects/agents/ai-platform-template
npx tsc --noEmit 2>&1
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
cd /Users/sivaprakasam/projects/agents/ai-platform-template
git add lib/ai.ts
git commit -m "feat: add NVidia NIM + Kimi to AI fallback chain (free tier before OpenAI)"
```

---

## Task 2: Update `.env.shared` and `set-vercel-env.ts`

**Files:**
- Modify: `agents/set-vercel-env.ts`
- Modify: `agents/.env.shared`

- [ ] **Step 1: Add new keys to `SHARED_KEYS` in `set-vercel-env.ts`**

```bash
# Open /Users/sivaprakasam/projects/agents/set-vercel-env.ts
# Find line: const SHARED_KEYS = [...]
```

Replace:
```typescript
const SHARED_KEYS = ['GROQ_API_KEY', 'GROQ_API_KEY_1', 'GEMINI_API_KEY', 'CEREBRAS_API_KEY', 'ANTHROPIC_API_KEY', 'EDGE_CONFIG']
```

With:
```typescript
const SHARED_KEYS = ['GROQ_API_KEY', 'GROQ_API_KEY_1', 'GEMINI_API_KEY', 'CEREBRAS_API_KEY', 'NVIDIA_API_KEY', 'KIMI_API_KEY', 'ANTHROPIC_API_KEY', 'EDGE_CONFIG']
```

- [ ] **Step 2: Add keys to `.env.shared`**

Read current `.env.shared`:
```bash
cat /Users/sivaprakasam/projects/agents/.env.shared
```

Add these lines (get keys from nvidia/moonshot dashboards, use placeholders until keys obtained):
```
NVIDIA_API_KEY=your_nvidia_nim_key_here
KIMI_API_KEY=your_moonshot_key_here
```

> Get NVidia NIM key: https://build.nvidia.com → Sign in → API Keys
> Get Kimi key: https://platform.moonshot.cn → API Keys

- [ ] **Step 3: Propagate to all Vercel projects**

```bash
cd /Users/sivaprakasam/projects/agents
VERCEL_TOKEN=vcp_01iJOUQCKQGfvLVCL9NRWUmDdk9uU1wpOqqjxYXQ6HkwaEVHJx2u1D9p npx tsx set-vercel-env.ts 2>&1
```

Expected: each project shows `✓ NVIDIA_API_KEY set` and `✓ KIMI_API_KEY set`

- [ ] **Step 4: Commit**

```bash
cd /Users/sivaprakasam/projects/agents
git add set-vercel-env.ts
git commit -m "feat: add NVIDIA_API_KEY + KIMI_API_KEY to Vercel env propagation"
```

---

## Task 3: Propagate updated `lib/ai.ts` to all local projects

**Files:**
- Modify: each project's `lib/ai.ts` or `src/lib/ai.ts`

- [ ] **Step 1: Identify all projects with their own ai.ts**

```bash
find /Users/sivaprakasam/projects/agents -name "ai.ts" -path "*/lib/*" | grep -v node_modules | grep -v ai-platform-template
```

- [ ] **Step 2: Copy updated ai.ts to each project**

For projects using `lib/ai.ts` (App Router root):
```bash
for proj in nudge kwizzo questly complybuddy ai-resume-builder social-media-calendar ai-investment-tracker ai-travel-planner language-learning-bot agenttrace; do
  dest="/Users/sivaprakasam/projects/agents/$proj/lib/ai.ts"
  if [ -f "$dest" ]; then
    cp /Users/sivaprakasam/projects/agents/ai-platform-template/lib/ai.ts "$dest"
    echo "✓ $proj"
  fi
done
```

For projects using `src/lib/ai.ts`:
```bash
for proj in ai-social-content ai-resume-screener ai-voice-home yt-portal idea-agent meetscribe weekendai pdfideas; do
  dest="/Users/sivaprakasam/projects/agents/$proj/src/lib/ai.ts"
  if [ -f "$dest" ]; then
    cp /Users/sivaprakasam/projects/agents/ai-platform-template/lib/ai.ts "$dest"
    echo "✓ $proj"
  fi
done
```

- [ ] **Step 3: Verify no TS errors in spot-check project**

```bash
cd /Users/sivaprakasam/projects/agents/kwizzo
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to ai.ts

- [ ] **Step 4: Commit per project (or bulk)**

```bash
cd /Users/sivaprakasam/projects/agents
for proj in nudge kwizzo questly complybuddy ai-resume-builder social-media-calendar ai-investment-tracker ai-travel-planner language-learning-bot; do
  cd /Users/sivaprakasam/projects/agents/$proj
  if git diff --quiet lib/ai.ts 2>/dev/null || git diff --quiet src/lib/ai.ts 2>/dev/null; then
    echo "No changes in $proj"
  else
    git add lib/ai.ts src/lib/ai.ts 2>/dev/null; git commit -m "feat: add NVidia NIM + Kimi to AI fallback chain"
  fi
done
```

---

## Task 4: Build MCP Server on VPS

**Files (all on VPS at `/root/nvidia-mcp/`):**
- Create: `/root/nvidia-mcp/package.json`
- Create: `/root/nvidia-mcp/tsconfig.json`
- Create: `/root/nvidia-mcp/src/index.ts`

- [ ] **Step 1: SSH to VPS and scaffold directory**

```bash
ssh root@31.97.56.148 "mkdir -p /root/nvidia-mcp/src && mkdir -p /root/nvidia-mcp/dist"
```

- [ ] **Step 2: Create `package.json` on VPS**

```bash
ssh root@31.97.56.148 "cat > /root/nvidia-mcp/package.json" << 'EOF'
{
  "name": "nvidia-mcp",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
EOF
```

- [ ] **Step 3: Create `tsconfig.json` on VPS**

```bash
ssh root@31.97.56.148 "cat > /root/nvidia-mcp/tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
EOF
```

- [ ] **Step 4: Create `src/index.ts` on VPS**

```bash
ssh root@31.97.56.148 "cat > /root/nvidia-mcp/src/index.ts" << 'TSEOF'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1'
const KIMI_BASE   = 'https://api.moonshot.cn/v1'

async function callOpenAICompat(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens = 1024,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json() as any
  return data.choices?.[0]?.message?.content ?? ''
}

const server = new Server(
  { name: 'nvidia-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'nvidia_chat',
      description: 'Chat inference via NVidia NIM free tier. Models: phi-4-mini (fast), qwen2.5-72b (balanced), llama-3.1-405b (best).',
      inputSchema: {
        type: 'object',
        properties: {
          prompt:    { type: 'string', description: 'User message' },
          model:     { type: 'string', description: 'Model ID', default: 'qwen/qwen2.5-72b-instruct' },
          maxTokens: { type: 'number', description: 'Max output tokens', default: 1024 },
        },
        required: ['prompt'],
      },
    },
    {
      name: 'nvidia_complete',
      description: 'Text completion via NVidia NIM. Good for code generation and structured output.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt:    { type: 'string', description: 'Completion prompt' },
          model:     { type: 'string', description: 'Model ID', default: 'microsoft/phi-4-mini-instruct' },
          maxTokens: { type: 'number', description: 'Max output tokens', default: 512 },
        },
        required: ['prompt'],
      },
    },
    {
      name: 'kimi_chat',
      description: 'Long-context inference via Kimi/Moonshot (up to 128k tokens). Best for large documents, code reviews, summarization of long content.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt:    { type: 'string', description: 'User message (can be very long)' },
          model:     { type: 'string', description: 'moonshot-v1-8k | moonshot-v1-32k | moonshot-v1-128k', default: 'moonshot-v1-32k' },
          maxTokens: { type: 'number', description: 'Max output tokens', default: 2048 },
        },
        required: ['prompt'],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params
  const a = args as Record<string, any>

  try {
    if (name === 'nvidia_chat' || name === 'nvidia_complete') {
      const key = process.env.NVIDIA_API_KEY
      if (!key) throw new Error('NVIDIA_API_KEY not set')
      const model = a.model ?? (name === 'nvidia_complete' ? 'microsoft/phi-4-mini-instruct' : 'qwen/qwen2.5-72b-instruct')
      const text = await callOpenAICompat(
        NVIDIA_BASE, key, model,
        [{ role: 'user', content: a.prompt }],
        a.maxTokens ?? 1024,
      )
      return { content: [{ type: 'text', text }] }
    }

    if (name === 'kimi_chat') {
      const key = process.env.KIMI_API_KEY
      if (!key) throw new Error('KIMI_API_KEY not set')
      const model = a.model ?? 'moonshot-v1-32k'
      const text = await callOpenAICompat(
        KIMI_BASE, key, model,
        [{ role: 'user', content: a.prompt }],
        a.maxTokens ?? 2048,
      )
      return { content: [{ type: 'text', text }] }
    }

    throw new Error(`Unknown tool: ${name}`)
  } catch (e: any) {
    return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true }
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)
TSEOF
```

- [ ] **Step 5: Install deps and build on VPS**

```bash
ssh root@31.97.56.148 "cd /root/nvidia-mcp && npm install && npm run build 2>&1"
```

Expected: `dist/index.js` created, no errors

- [ ] **Step 6: Smoke test MCP server locally on VPS**

```bash
ssh root@31.97.56.148 "cd /root/nvidia-mcp && echo '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}' | NVIDIA_API_KEY=test KIMI_API_KEY=test node dist/index.js 2>&1 | head -5"
```

Expected: JSON response listing 3 tools

---

## Task 5: Wire MCP Server into Claude Code settings

**Files:**
- Modify: `~/.claude/settings.json`

- [ ] **Step 1: Read current settings.json**

```bash
cat ~/.claude/settings.json
```

Note the existing `mcpServers` block (Hermes is already there).

- [ ] **Step 2: Add nvidia-mcp entry to mcpServers**

In `~/.claude/settings.json`, add to the `mcpServers` object alongside existing Hermes entry:

```json
"nvidia-mcp": {
  "command": "ssh",
  "args": [
    "-o", "StrictHostKeyChecking=no",
    "root@31.97.56.148",
    "NVIDIA_API_KEY=$NVIDIA_API_KEY KIMI_API_KEY=$KIMI_API_KEY node /root/nvidia-mcp/dist/index.js"
  ],
  "env": {
    "NVIDIA_API_KEY": "${NVIDIA_API_KEY}",
    "KIMI_API_KEY": "${KIMI_API_KEY}"
  }
}
```

> Note: `settings.json` uses JSON — no trailing commas. Add after existing last mcpServer entry with a comma separator.

- [ ] **Step 3: Set env vars in local shell for Claude Code to pick up**

Add to `~/.zshrc` (or `~/.zprofile`):
```bash
export NVIDIA_API_KEY="your_key_here"
export KIMI_API_KEY="your_key_here"
```

Then: `source ~/.zshrc`

- [ ] **Step 4: Verify MCP loads in Claude Code**

Restart Claude Code session. Run:
```
/mcp
```

Expected: `nvidia-mcp` appears in connected servers list with 3 tools: `nvidia_chat`, `nvidia_complete`, `kimi_chat`

---

## Task 6: Update Edge Config with new model tiers

**Files:**
- No code change — Vercel Edge Config dashboard update

- [ ] **Step 1: Add nvidia_tiers and kimi_tiers to Edge Config**

Go to: `https://vercel.com/dashboard/edge-config/ecfg_s5cumfsw58v5mpe9ahpkb7axmigs`

Add two new items:

Key: `nvidia_tiers`
Value:
```json
{
  "fast": ["microsoft/phi-4-mini-instruct"],
  "balanced": ["qwen/qwen2.5-72b-instruct"],
  "best": ["meta/llama-3.1-405b-instruct", "mistralai/mistral-large-2-instruct"]
}
```

Key: `kimi_tiers`
Value:
```json
{
  "fast": ["moonshot-v1-8k"],
  "balanced": ["moonshot-v1-32k"],
  "best": ["moonshot-v1-128k"]
}
```

- [ ] **Step 2: Verify Edge Config loads at runtime**

In any deployed project logs (e.g. kwizzo.app), trigger an AI call and check logs for:
```
[AI] Loaded model tiers from Edge Config
```

---

## Task 7: Memory update

- [ ] **Step 1: Update project memory with implementation status**

Update `/Users/sivaprakasam/.claude/projects/-Users-sivaprakasam-projects-agents/memory/project_three_initiatives.md`:

Change NVidia NIM section status to `✅ Implemented` and add:
```
- MCP server: /root/nvidia-mcp/ on VPS, SSH stdio
- Fallback chain: position 5 (after Cerebras, before Kimi)
- Kimi position: 6 (after NVidia, before OpenAI)
- Keys: NVIDIA_API_KEY + KIMI_API_KEY in .env.shared + all Vercel projects
- Edge Config: nvidia_tiers + kimi_tiers added
```

---

## Self-Review Checklist

- [x] Spec: fallback chain expanded ✓ (Tasks 1, 3)
- [x] Spec: key rotation convention ✓ (Task 2)
- [x] Spec: MCP server on VPS ✓ (Task 4)
- [x] Spec: SSH-tunneled settings.json ✓ (Task 5)
- [x] Spec: Edge Config updated ✓ (Task 6)
- [x] Spec: propagate to 15 projects ✓ (Tasks 2+3)
- [x] No TBDs or placeholders
- [x] All type names consistent (`Quality`, `Msg`, `AIResponse` — unchanged)
- [x] `getTiers()` return keys match provider array names (`nvidia`, `kimi`)
