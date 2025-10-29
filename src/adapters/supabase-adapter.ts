import type { Context } from "hono";
import { createServerClient } from "@supabase/ssr";
import type {
	AuthAdapter,
	AuthUser,
	AuthSession,
} from "../interfaces";
import type { TokenExchangeResult } from "../interfaces";

/**
 * Bindings required for Supabase authentication
 */
export interface SupabaseBindings {
	OAUTH_PROVIDER: any;
}

/**
 * Configuration required to instantiate SupabaseAuthAdapter
 */
export interface SupabaseAdapterConfig {
	supabaseUrl: string;
	supabaseAnonKey: string;
}

/**
 * SupabaseAuthAdapter implements authentication using Supabase
 */
export class SupabaseAuthAdapter implements AuthAdapter<SupabaseBindings> {
	private readonly supabaseUrl: string;
	private readonly supabaseAnonKey: string;

	constructor(config: SupabaseAdapterConfig) {
		this.supabaseUrl = config.supabaseUrl;
		this.supabaseAnonKey = config.supabaseAnonKey;
	}
	/**
	 * Create a Supabase SSR client for the given context
	 */
	private getClient(c: Context<{ Bindings: SupabaseBindings }>) {
		const supabase = createServerClient(
			this.supabaseUrl,
			this.supabaseAnonKey,
			{
				cookies: {
					getAll() {
						const cookieHeader = c.req.raw.headers.get("Cookie");
						if (!cookieHeader) return [];

						return cookieHeader
							.split(";")
							.map((cookie: string) => {
								const [name, ...valueParts] = cookie.trim().split("=");
								return {
									name: name.trim(),
									value: valueParts.join("=").trim(),
								};
							})
							.filter(
								(cookie: { name: string; value: string }) =>
									cookie.name && cookie.value,
							);
					},
					setAll(cookiesToSet: { name: string; value: string }[]) {
						cookiesToSet.forEach(({ name, value }) => {
							c.header(
								"Set-Cookie",
								`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax`,
							);
						});
					},
				},
			},
		);
		return supabase;
	}

	async getUser(c: Context<{ Bindings: SupabaseBindings }>): Promise<AuthUser | null> {
		const supabase = this.getClient(c);
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) return null;

		return {
			id: user.id,
			email: user.email ?? null,
		};
	}

	async getSession(c: Context<{ Bindings: SupabaseBindings }>): Promise<AuthSession | null> {
		const supabase = this.getClient(c);
		const { data: sessionData } = await supabase.auth.getSession();

		if (!sessionData.session) return null;

		return {
			accessToken: sessionData.session.access_token,
			refreshToken: sessionData.session.refresh_token,
			// Supabase-specific fields for API calls and token refresh
			supabaseBaseUrl: this.supabaseUrl,
			supabaseAnonKey: this.supabaseAnonKey,
		};
	}

	async getAuthorizationProps(
		c: Context<{ Bindings: SupabaseBindings }>,
		user: AuthUser,
		session: AuthSession,
	): Promise<Record<string, any>> {
		return {
			userEmail: user.email ?? "",
			userId: user.id,
			// Generic token fields for MCP tools
			accessToken: session.accessToken,
			refreshToken: session.refreshToken,
			// Supabase-specific configuration
			supabaseBaseUrl: session.supabaseBaseUrl ?? this.supabaseUrl,
			supabaseAnonKey: session.supabaseAnonKey ?? this.supabaseAnonKey,
		};
	}

	/**
	 * Handle refresh_token exchange with Supabase
	 */
	async tokenExchangeCallback({
		grantType,
		props,
	}: {
		grantType: string;
		props: Record<string, any>;
	}): Promise<TokenExchangeResult | void> {
		if (grantType !== "refresh_token") return;

		const rt = props?.refreshToken as string | undefined;
		const supabaseBaseUrl = (props?.supabaseBaseUrl as string | undefined) ?? this.supabaseUrl;
		const supabaseAnonKey = (props?.supabaseAnonKey as string | undefined) ?? this.supabaseAnonKey;
		if (!rt || !supabaseBaseUrl || !supabaseAnonKey) return;

		const url = new URL(`${supabaseBaseUrl}/auth/v1/token`);
		url.searchParams.set("grant_type", "refresh_token");
		const resp = await fetch(url.toString(), {
			method: "POST",
			headers: {
				"content-type": "application/json",
				apikey: supabaseAnonKey,
				Authorization: `Bearer ${supabaseAnonKey}`,
			},
			body: JSON.stringify({ refresh_token: rt }),
		});
		if (!resp.ok) return;
		const json: any = await resp.json();
		const newAccess = (json?.access_token as string) ?? props.accessToken;
		const newRefresh = (json?.refresh_token as string) ?? rt;

		return {
			accessTokenProps: { ...props, accessToken: newAccess },
			newProps: {
				...props,
				accessToken: newAccess,
				refreshToken: newRefresh,
			},
		};
	}
}

