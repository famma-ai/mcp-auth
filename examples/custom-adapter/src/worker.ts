import { createOAuthProviderWithMCP, type AppConfig } from 'famma-mcp-sdk';
import { McpAgent } from 'agents/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ExecutionContext } from '@cloudflare/workers-types';
import { HeaderAuthAdapter } from './header-auth-adapter';

class ExampleMCP extends McpAgent {
  server = new McpServer({ name: 'HeaderAuthExample', version: '1.0.0' });
  async init() {
    this.server.tool('whoami', async () => ({
      content: [{ type: 'text', text: String(this.props?.userEmail ?? 'Unknown user') }],
    }));
  }
}

let provider: ReturnType<typeof createOAuthProviderWithMCP> | undefined;

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    if (!provider) {
      const appConfig: AppConfig = {
        logoUrl: env.LOGO_URL ?? 'https://example.com/logo.png',
        companyName: env.COMPANY_NAME ?? 'Example Co',
        proxyTargetUrl: env.PROXY_TARGET_URL ?? 'https://your-login-host.example.com',
      };
      const authAdapter = new HeaderAuthAdapter();
      provider = createOAuthProviderWithMCP({
        mcpAgentClass: ExampleMCP as unknown as typeof McpAgent,
        authAdapter,
        appConfig,
      });
    }
    return provider.fetch(request, env, ctx);
  },
};


