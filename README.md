# Famma MCP SDK

SDK for building OAuth-protected Remote MCP servers on Cloudflare Workers with pluggable auth adapters (Supabase included).

- Exported primitives: `createOAuthProviderWithMCP`, `createAuthProxy`
- Adapters: `SupabaseAuthAdapter`
- Types: `AppConfig`, `AuthAdapter`, `CoreBindings`, `TokenExchangeResult`
- Example Worker: `examples/cloudflare-worker/`

## Install

```bash
npm install famma-mcp-sdk @cloudflare/workers-oauth-provider hono
# If your MCP Agent comes from agents/mcp
npm install agents @modelcontextprotocol/sdk
```

## Quickstart (Cloudflare Worker)

Your MCP Agent must expose a static `mount(route)` (as `agents/mcp` does).

```ts
// src/worker.ts
import { createOAuthProviderWithMCP, SupabaseAuthAdapter, type AppConfig } from "famma-mcp-sdk";
import type { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

class MyMCP extends (McpAgent as unknown as { new(): any; mount(route: string): any }) {
  server = new McpServer({ name: "Demo", version: "1.0.0" });
  async init() {
    this.server.tool("whoami", async () => ({
      content: [{ type: "text", text: String(this.props?.userEmail ?? "Unknown user") }],
    }));
  }
}

let provider: ReturnType<typeof createOAuthProviderWithMCP> | undefined;

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    if (!provider) {
      const appConfig: AppConfig = {
        logoUrl: env.LOGO_URL ?? "https://example.com/logo.png",
        companyName: env.COMPANY_NAME ?? "Example Co",
        proxyTargetUrl: env.PROXY_TARGET_URL,
      };

      const authAdapter = new SupabaseAuthAdapter({
        supabaseUrl: env.SUPABASE_URL,
        supabaseAnonKey: env.SUPABASE_ANON_KEY,
        proxyTargetUrl: appConfig.proxyTargetUrl,
        oauthProvider: undefined,
      });

      provider = createOAuthProviderWithMCP({
        mcpAgentClass: MyMCP as unknown as typeof McpAgent,
        authAdapter,
        appConfig,
      });
    }
    return provider.fetch(request, env, ctx);
  },
};
```

### wrangler.jsonc

```json
{
  "name": "mcp-worker",
  "main": "src/worker.ts",
  "compatibility_date": "2025-03-10",
  "compatibility_flags": ["nodejs_compat"],
  "kv_namespaces": [
    { "binding": "OAUTH_KV", "id": "<your-kv-id>" }
  ],
  "vars": {
    "COMPANY_NAME": "Example Co",
    "LOGO_URL": "https://example.com/logo.png",
    "PROXY_TARGET_URL": "https://your-login-host.example.com"
  }
}
```

### Set secrets and run

```bash
# One time: create KV namespace
npx wrangler kv namespace create OAUTH_KV

# Secrets for Supabase
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY

# Local dev
npx wrangler dev
```

Visit:
- `/authorize` – start OAuth flow
- `/auth/login` – proxies to your `PROXY_TARGET_URL` when unauthenticated
- `/mcp` – MCP route

## Example Project

See `examples/cloudflare-worker/` for a complete working Worker with:
- Example MCP agent
- Runtime adapter construction from `env`
- Dev vars template and Wrangler config

## Building a Custom Auth Provider (non-Supabase)

Implement the `AuthAdapter` interface and pass your adapter to `createOAuthProviderWithMCP`.

Key responsibilities:
- `getUser(c)`: return `{ id, email }` when authenticated, or `null`.
- `getSession(c)`: return `{ accessToken, refreshToken, ... }` or `null`.
- `getAuthorizationProps(c, user, session)`: return properties to persist with the OAuth token. Include anything required for future refreshes (e.g., API base URL, client id/secret, tenant).
- `tokenExchangeCallback({ grantType, props })` (optional): perform refresh flow and return updated tokens.

Minimal skeleton:

```ts
import type { Context } from 'hono';
import type {
  AuthAdapter,
  AuthUser,
  AuthSession,
  CoreBindings,
  TokenExchangeResult,
} from 'famma-mcp-sdk';

export interface MyBindings extends CoreBindings {
  // Add any additional env bindings if your provider needs them
}

export class HeaderAuthAdapter implements AuthAdapter<MyBindings> {
  async getUser(c: Context<{ Bindings: MyBindings }>): Promise<AuthUser | null> {
    // Example: derive user from headers/cookies/session
    const userId = c.req.header('x-user-id');
    const userEmail = c.req.header('x-user-email');
    if (!userId) return null;
    return { id: userId, email: userEmail ?? null };
  }

  async getSession(c: Context<{ Bindings: MyBindings }>): Promise<AuthSession | null> {
    // Example: access token from header/cookie; refresh token optional
    const accessToken = c.req.header('x-access-token');
    const refreshToken = c.req.header('x-refresh-token') ?? '';
    if (!accessToken) return null;
    return { accessToken, refreshToken };
  }

  async getAuthorizationProps(
    _c: Context<{ Bindings: MyBindings }>,
    user: AuthUser,
    session: AuthSession,
  ): Promise<Record<string, any>> {
    return {
      userEmail: user.email ?? '',
      userId: user.id,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      // Add provider-specific props needed for future refresh
      providerBaseUrl: 'https://api.example.com',
      clientId: 'your-client-id',
    };
  }

  // Optional: implement refresh flow
  async tokenExchangeCallback({ grantType, props }: { grantType: string; props: Record<string, any> }): Promise<TokenExchangeResult | void> {
    if (grantType !== 'refresh_token') return;
    const rt = props?.refreshToken as string | undefined;
    if (!rt) return;
    // Perform your provider's refresh request here
    // const resp = await fetch('https://api.example.com/oauth/token', { ... });
    // const json = await resp.json();
    const newAccess = 'NEW_ACCESS_TOKEN';
    const newRefresh = rt; // or a rotated token
    return {
      accessTokenProps: { ...props, accessToken: newAccess },
      newProps: { ...props, accessToken: newAccess, refreshToken: newRefresh },
      // accessTokenTTL: json.expires_in,
    };
  }
}
```

Wire it into a Worker:

```ts
import { createOAuthProviderWithMCP, type AppConfig } from 'famma-mcp-sdk';
import { McpAgent } from 'agents/mcp';
import { HeaderAuthAdapter } from './header-auth-adapter';

class MyMCP extends McpAgent { /* ...tools... */ }

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    const appConfig: AppConfig = {
      logoUrl: env.LOGO_URL,
      companyName: env.COMPANY_NAME,
      proxyTargetUrl: env.PROXY_TARGET_URL,
    };
    const authAdapter = new HeaderAuthAdapter();
    return createOAuthProviderWithMCP({
      mcpAgentClass: MyMCP,
      authAdapter,
      appConfig,
    }).fetch(request, env, ctx);
  }
}
```

A full runnable sample is in `examples/custom-adapter/`.

## API

```ts
import {
  createOAuthProviderWithMCP,
  createAuthProxy,
  SupabaseAuthAdapter,
  type SupabaseAdapterConfig,
  type SupabaseBindings,
  type AppConfig,
  type AuthAdapter,
  type CoreBindings,
  type TokenExchangeResult,
} from "famma-mcp-sdk";
```

- `createOAuthProviderWithMCP({ mcpAgentClass, authAdapter, appConfig, tokenExchangeCallback? })`
  - Returns an `OAuthProvider` Worker-compatible handler. Uses `authAdapter.tokenExchangeCallback` by default.
- `createAuthProxy(authAdapter, appConfig)`
  - Returns a Hono app implementing `/authorize`, `/approve`, `/auth/login`, and reverse proxy.
- `SupabaseAuthAdapter(config: SupabaseAdapterConfig)`
  - Requires: `supabaseUrl`, `supabaseAnonKey`, `proxyTargetUrl`, `oauthProvider` (not currently used by the adapter).

### AuthAdapter contract

```ts
interface AuthAdapter<TBindings = any> {
  getUser(c): Promise<AuthUser | null>;
  getSession(c): Promise<AuthSession | null>;
  getAuthorizationProps(c, user, session): Promise<Record<string, any>>;
  tokenExchangeCallback?: (args: { grantType: string; props: Record<string, any> }) => Promise<TokenExchangeResult | void>;
}
```

The Supabase adapter implements `tokenExchangeCallback` to rotate `refresh_token` via Supabase.

## Notes
- Cloudflare Workers do not use `process.env`; read runtime config from `env` in `fetch`.
- The OAuth provider requires `OAUTH_KV` configured in Wrangler.
- You can provide your own `tokenExchangeCallback` in `createOAuthProviderWithMCP` to override adapter behavior.

