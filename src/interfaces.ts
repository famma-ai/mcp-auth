import type { Context } from "hono";

/**
 * User information returned by the auth adapter
 */
export interface AuthUser {
	id: string;
	email: string | null;
}

/**
 * Session information including tokens and metadata
 */
export interface AuthSession {
	accessToken: string;
	refreshToken: string;
	[key: string]: any; // Allow additional adapter-specific properties
}

/**
 * Result returned from a token exchange callback
 */
export interface TokenExchangeResult {
	accessTokenProps?: Record<string, any>;
	newProps?: Record<string, any>;
	accessTokenTTL?: number;
}

/**
 * AuthAdapter abstracts authentication provider operations
 * Implementations handle provider-specific logic (Supabase, Auth0, etc.)
 */
export interface AuthAdapter<TBindings extends Record<string, any> = any> {
	/**
	 * Check if a user is currently authenticated
	 * @returns User object if authenticated, null otherwise
	 */
	getUser(c: Context<{ Bindings: TBindings }>): Promise<AuthUser | null>;

	/**
	 * Get the current session including access/refresh tokens
	 * @returns Session object with tokens and any additional props
	 */
	getSession(c: Context<{ Bindings: TBindings }>): Promise<AuthSession | null>;

	/**
	 * Get props to pass to completeAuthorization
	 * These are provider-specific and will be stored with the OAuth token
	 */
	getAuthorizationProps(
		c: Context<{ Bindings: TBindings }>,
		user: AuthUser,
		session: AuthSession,
	): Promise<Record<string, any>>;

	/**
	 * Optional handler for provider token exchange events (e.g., refresh_token)
	 */
	tokenExchangeCallback?: (args: {
		grantType: string;
		props: Record<string, any>;
	}) => Promise<TokenExchangeResult | void>;
}

/**
 * Application configuration
 */
export interface AppConfig {
	/** URL of the logo to display in auth screens */
	logoUrl: string;
	/** Company/application name to display */
	companyName: string;
	/** Target URL to proxy requests to */
	proxyTargetUrl: string;
}

/**
 * Bindings that include OAuth provider helpers
 */
export interface CoreBindings {
	OAUTH_PROVIDER: any; // OAuthHelpers from @cloudflare/workers-oauth-provider
}

