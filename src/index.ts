import type { McpAgent } from "agents/mcp";

import OAuthProvider from "@cloudflare/workers-oauth-provider";
import type { ExecutionContext } from "@cloudflare/workers-types";
import { createAuthProxy } from "./core";
import type { AppConfig, AuthAdapter, CoreBindings, TokenExchangeResult } from "./interfaces";

export type { AppConfig, AuthAdapter, CoreBindings, TokenExchangeResult } from "./interfaces";
export { createAuthProxy } from "./core";
export {
    SupabaseAuthAdapter,
    type SupabaseAdapterConfig,
    type SupabaseBindings,
} from "./adapters/supabase-adapter";


export interface CreateOAuthProviderOptions<TBindings extends CoreBindings = CoreBindings> {
    mcpAgentClass: typeof McpAgent; // Require MCPAgent class with static mount(route)
    authAdapter: AuthAdapter<TBindings>;
    appConfig: AppConfig;
    apiRoute?: string;
    authorizeEndpoint?: string;
    tokenEndpoint?: string;
    clientRegistrationEndpoint?: string;
    tokenExchangeCallback?: (args: { grantType: string; props: Record<string, any> }) => Promise<TokenExchangeResult | void>;
}

// Factory to create an OAuthProvider with a provided MCP Agent and auth adapter
export function createOAuthProviderWithMCP<TBindings extends CoreBindings = CoreBindings>({
    mcpAgentClass,
    authAdapter,
    appConfig,
    apiRoute = "/mcp",
}: CreateOAuthProviderOptions<TBindings>) {
    const defaultHandler = {
        async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
            const app = createAuthProxy(authAdapter, appConfig);
            return app.fetch(request, env, ctx);
        },
    };

    return new OAuthProvider({
        apiRoute,
        apiHandler: mcpAgentClass.mount(apiRoute),
        defaultHandler,
		authorizeEndpoint: "/authorize",
		tokenEndpoint: "/token",
		clientRegistrationEndpoint: "/register",
        tokenExchangeCallback: authAdapter.tokenExchangeCallback,
    });
}