# Supabase MCP Worker Example

This example shows how to wire an MCP Agent to the OAuth auth proxy provided by the SDK, using Supabase auth.

## Prerequisites
- Cloudflare Wrangler CLI
- A Supabase project (URL and anon key)

## Setup

1) Create a KV namespace for the OAuth provider state:

```bash
npx wrangler kv namespace create OAUTH_KV
```

Copy the returned id into `wrangler.jsonc` under `kv_namespaces[0].id`.

2) Set local dev vars (optional):

```bash
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your SUPABASE_URL and SUPABASE_ANON_KEY
```

3) Run locally:

```bash
npx wrangler dev
```

Endpoints to try:
- `/authorize` – starts the OAuth approval flow
- `loginPath` – proxies to `PROXY_TARGET_URL` when unauthenticated (default: `/auth/login`)
- `/mcp` – MCP API route

## Notes
- You can customize the login route via `appConfig.loginPath` (defaults to `/auth/login`).
- The Supabase adapter is constructed inside the `fetch` handler to read Cloudflare `env` bindings.
- Replace `ExampleMCP` with your own MCP Agent class (should be of type `agents/mcp`, i.e., extend or be compatible with `McpAgent`).
