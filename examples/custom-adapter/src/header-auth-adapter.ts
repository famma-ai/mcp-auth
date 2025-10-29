import type { Context } from 'hono';
import type {
  AuthAdapter,
  AuthUser,
  AuthSession,
  CoreBindings,
  TokenExchangeResult,
} from '@famma/mcp-auth';

export interface ExampleBindings extends CoreBindings {}

export class HeaderAuthAdapter implements AuthAdapter<ExampleBindings> {
  async getUser(c: Context<{ Bindings: ExampleBindings }>): Promise<AuthUser | null> {
    const userId = c.req.header('x-user-id');
    const userEmail = c.req.header('x-user-email');
    if (!userId) return null;
    return { id: userId, email: userEmail ?? null };
  }

  async getSession(c: Context<{ Bindings: ExampleBindings }>): Promise<AuthSession | null> {
    const accessToken = c.req.header('x-access-token');
    const refreshToken = c.req.header('x-refresh-token') ?? '';
    if (!accessToken) return null;
    return { accessToken, refreshToken };
  }

  async getAuthorizationProps(
    _c: Context<{ Bindings: ExampleBindings }>,
    user: AuthUser,
    session: AuthSession,
  ): Promise<Record<string, any>> {
    return {
      userEmail: user.email ?? '',
      userId: user.id,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      providerBaseUrl: 'https://api.example.com',
      clientId: 'your-client-id',
    };
  }

  async tokenExchangeCallback({ grantType, props }: { grantType: string; props: Record<string, any> }): Promise<TokenExchangeResult | void> {
    if (grantType !== 'refresh_token') return;
    const rt = props?.refreshToken as string | undefined;
    if (!rt) return;
    const newAccess = 'NEW_ACCESS_TOKEN';
    const newRefresh = rt;
    return {
      accessTokenProps: { ...props, accessToken: newAccess },
      newProps: { ...props, accessToken: newAccess, refreshToken: newRefresh },
    };
  }
}


