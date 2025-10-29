# Custom Adapter Example (HeaderAuthAdapter)

An example showing how to implement a non-Supabase auth provider by fulfilling the `AuthAdapter` interface.

## Idea
- Treat incoming headers (`x-user-id`, `x-user-email`, `x-access-token`, `x-refresh-token`) as the auth source.
- Provide `getUser`, `getSession`, and `getAuthorizationProps`.
- Optionally implement `tokenExchangeCallback` to refresh tokens.

## Run
1) Ensure you have a KV namespace for the OAuth provider (`OAUTH_KV`) if you use the Cloudflare provider features.
2) Provide headers when calling `/authorize` or `/mcp` during testing (e.g., via cURL/Postman) to simulate authentication.
3) `wrangler dev` from this folder (ensure imports resolve to your built/published SDK).

See `src/header-auth-adapter.ts` and `src/worker.ts`.

### Notes
- You can set a custom login route via `appConfig.loginPath` (defaults to `/auth/login`).
