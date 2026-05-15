# Share Market AI Assistant

AI-powered stock market analysis assistant using Claude, FastAPI, and yfinance.

## Quick Start

```bash
# Install dependencies
pip install -e ".[dev]"

# Copy and fill in environment variables
cp .env.example .env

# Run the server
uvicorn app.main:app --reload

# Run tests
pytest -p no:langsmith

# Lint
ruff check app/ tests/
```

## Architecture

- **FastAPI** backend with async endpoints
- **Claude** (Anthropic) with tool-use for agentic stock analysis
- **yfinance** for free market data
- **Supabase** for auth (JWT) and PostgreSQL database
- **Upstash Redis** for caching (HTTP-based, serverless)
- **n8n** for workflow automation (alerts, scheduled summaries)

## Key Endpoints

- `GET /health` - Health check
- `POST /api/v1/auth/signup` - Register
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/chat` - AI chat (requires auth)
- `GET /api/v1/market/price/{symbol}` - Stock price
- `GET /api/v1/market/history/{symbol}` - OHLCV history
- `GET /api/v1/market/info/{symbol}` - Company info
- `GET /api/v1/market/financials/{symbol}` - Financial statements
- `GET /api/v1/market/recommendations/{symbol}` - Analyst ratings
- `GET /api/v1/market/news/{symbol}` - Stock news

## Supabase Tables

Create these tables in your Supabase project:

```sql
create table conversations (
  id uuid primary key,
  user_id uuid references auth.users(id) not null,
  messages jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  symbol text not null,
  threshold numeric not null,
  direction text not null check (direction in ('above', 'below')),
  active boolean default true,
  created_at timestamptz default now()
);

alter table conversations enable row level security;
alter table alerts enable row level security;
```

## n8n Setup

```bash
docker compose up -d
```

Then import workflows from `n8n/workflows/` via the n8n UI at http://localhost:5678.

## Project Structure

```
app/
  main.py          - FastAPI app + lifespan
  config.py        - Settings from env vars
  deps.py          - Auth dependency
  routers/         - API route handlers
  services/        - Business logic (agent, market data, cache, supabase_client)
  tools/           - Claude tool definitions
  schemas/         - Pydantic models
tests/             - Unit and integration tests
n8n/workflows/     - n8n workflow JSON exports
```

## Performance Optimization (IMPLEMENTED)

The site was slow because yfinance is synchronous (500ms-5s per call). Fixed with three-tier caching.

### Solution: Three-Tier Caching Architecture

**Data Flow:**
```
Browser → Redis (L1) → stock_cache DB (L2) → yfinance (L3)
                ↑              ↑
           <10ms          <50ms
```

### What Was Implemented

1. **`app/services/cache.py`** - Increased `TTL_PRICE` from 60s to 300s (5 min)

2. **`app/services/supabase_client.py`** - Added:
   - `get_stock_cache(symbol)` - Read from stock_cache table
   - `upsert_stock_cache(symbol, ...)` - Write to stock_cache table

3. **`app/routers/market.py`** - Updated `_cached()` to check:
   - Redis first (fastest)
   - Then stock_cache table (prefetched data)
   - Then yfinance (live, slowest)

4. **`app/routers/internal.py`** - New internal endpoint:
   - `POST /api/v1/internal/prefetch-stocks` - Prefetches 27 popular symbols
   - Protected by `X-Webhook-Secret` header
   - Called by n8n every 5 minutes

5. **`n8n/workflows/stock_prefetch.json`** - New workflow:
   - Runs every 5 minutes
   - Calls the prefetch endpoint
   - Logs success/errors

### Manual Step Required: Create Supabase Table

Run this SQL in your Supabase SQL editor:

```sql
create table stock_cache (
  symbol text primary key,
  price_data jsonb,
  info_data jsonb,
  news_data jsonb,
  recommendations_data jsonb,
  updated_at timestamptz default now()
);

create index idx_stock_cache_updated on stock_cache(updated_at);

alter table stock_cache enable row level security;
create policy "Public read access" on stock_cache for select using (true);
```

Then import `n8n/workflows/stock_prefetch.json` into n8n UI.

### Prefetched Symbols (27 total)

Tech: AAPL, MSFT, GOOGL, AMZN, META, NVDA, TSLA, AMD, NFLX, INTC
Finance: JPM, BAC, WFC, GS, V, MA
Healthcare: JNJ, PFE, UNH, ABBV
Energy: XOM, CVX, COP
ETFs: SPY, QQQ, DIA, IWM

To add more, edit `PREFETCH_SYMBOLS` in `app/routers/internal.py`.

### Expected Performance

| Scenario | Before | After |
|----------|--------|-------|
| Popular stock (prefetched) | 500-2000ms | <50ms |
| Any stock (Redis hit) | <10ms | <10ms |
| Cold request | 500-5000ms | 500-5000ms (rare) |
| Concurrent users | ~50 max | 1000+ |
