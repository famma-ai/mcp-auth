import { Hono } from "hono";
import {
	layout,
	parseApproveFormBody,
	renderAuthorizationRejectedContent,
	renderAuthorizationApprovedContent,
	renderLoggedInAuthorizeScreen,
	renderAuthorizationRejectedPage,
} from "./utils";
import type { AuthAdapter, AppConfig, CoreBindings } from "./interfaces";

/**
 * Factory function to create a Hono app with OAuth authorization routes
 * @param authAdapter - Authentication adapter (e.g., SupabaseAuthAdapter)
 * @param config - Application configuration (logo, company name, proxy target)
 * @returns Configured Hono app
 */
export function createAuthProxy<TBindings extends CoreBindings>(
	authAdapter: AuthAdapter<TBindings>,
	config: AppConfig,
) {
	const app = new Hono<{ Bindings: TBindings }>();

	// Render an authorization page
	// If the user is logged in, we'll show a form to approve the authorization request
	// If the user is not logged in, we'll redirect them to login
	app.get("/authorize", async (c) => {
		const user = await authAdapter.getUser(c);
		const isLoggedIn = user !== null;

		const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(
			c.req.raw,
		);
		const currentUrl = new URL(c.req.url);
		const authorizeUrlWithParams = currentUrl.pathname + currentUrl.search;

		// If not logged in, redirect to login page
		if (!isLoggedIn) {
			const isHttps = currentUrl.protocol === "https:";
			const cookieValue =
				`return_to=${encodeURIComponent(currentUrl.pathname + currentUrl.search)}; Path=/; HttpOnly; SameSite=Lax` +
				(isHttps ? "; Secure" : "");
			console.log(
				"/authorize: unauthenticated, setting return_to and redirecting",
				{
					returnTo: currentUrl.pathname + currentUrl.search,
					isHttps,
				},
			);
			const res = c.redirect(
				`/auth/login?redirect=${encodeURIComponent(currentUrl.pathname + currentUrl.search)}`,
			);
			res.headers.append("Set-Cookie", cookieValue);
			return res;
		}

		const content = await renderLoggedInAuthorizeScreen(
			oauthReqInfo,
			authorizeUrlWithParams,
			config.logoUrl,
			config.companyName,
		);
		return c.html(layout(content, config.companyName));
	});

	// The /authorize page has a form that will POST to /approve
	// This endpoint is responsible for validating any login information and
	// then completing the authorization request with the OAUTH_PROVIDER
	app.post("/approve", async (c) => {
		const user = await authAdapter.getUser(c);

		const { oauthReqInfo, action, authorizeUrl } = await parseApproveFormBody(
			await c.req.parseBody(),
		);

		if (!oauthReqInfo) {
			return c.html("INVALID LOGIN", 401);
		}

		// User must be authenticated
		if (!user) {
			return c.html(
				layout(
					await renderAuthorizationRejectedContent("/auth/login"),
					config.companyName,
				),
			);
		}

		// If the user explicitly rejected, show a dead-end page and do not complete authorization
		if (action === "reject") {
			// Preserve the original authorize URL (including params) if provided
			const backToAuthorize =
				typeof authorizeUrl === "string" && authorizeUrl
					? authorizeUrl
					: "/authorize";
			return c.html(
				layout(
					await renderAuthorizationRejectedPage(backToAuthorize, config.companyName),
					config.companyName,
				),
			);
		}

		// Get session information from the adapter
		const session = await authAdapter.getSession(c);
		if (!session) {
			return c.html(
				layout(
					await renderAuthorizationRejectedContent("/auth/login"),
					config.companyName,
				),
			);
		}

		// Get adapter-specific props for completeAuthorization
		const props = await authAdapter.getAuthorizationProps(c, user, session);

		// The user must be successfully logged in and have approved the authorization, so we
		// can complete the authorization request
		let redirectTo: string;
		try {
			({ redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
				request: oauthReqInfo,
				userId: user.id,
				metadata: {
					label: user.email ?? "User",
				},
				scope: oauthReqInfo.scope,
				props,
			}));
		} catch (e) {
			console.error("/approve: completeAuthorization failed", e, {
				oauthReqInfo,
				userId: user.id,
			});
			return c.text("Authorization failed: invalid request.", 400);
		}

		return c.html(
			layout(
				await renderAuthorizationApprovedContent(redirectTo),
				config.companyName,
			),
		);
	});

	// Login route: show proxied login when unauthenticated, otherwise bounce back to where we came from
	app.get("/auth/login", async (c) => {
		const user = await authAdapter.getUser(c);

		// If not logged in yet, proxy the upstream login page at this same path
		if (!user) {
			const url = new URL(c.req.url);
			const targetUrl = new URL(url.pathname + url.search, config.proxyTargetUrl);
			console.log("/auth/login: unauthenticated, proxying login", {
				path: url.pathname + url.search,
				target: targetUrl.toString(),
			});

			const headers = new Headers();
			for (const [key, value] of c.req.raw.headers) {
				if (key.toLowerCase() !== "host") {
					headers.set(key, value);
				}
			}

			let body: ArrayBuffer | null = null;
			if (c.req.method !== "GET" && c.req.method !== "HEAD") {
				body = await c.req.arrayBuffer();
			}

			const proxyRequest = new Request(targetUrl.toString(), {
				method: c.req.method,
				headers,
				body,
			});

			try {
				const response = await fetch(proxyRequest);
				const responseHeaders = new Headers(response.headers);
				return new Response(response.body, {
					status: response.status,
					statusText: response.statusText,
					headers: responseHeaders,
				});
			} catch (error) {
				console.error("/auth/login: login proxy failed", error);
				return c.text("Internal Server Error", 500);
			}
		}

		// If authenticated, redirect to the stored return URL or back to /authorize
		const cookieHeader = c.req.raw.headers.get("Cookie") ?? "";
		const cookiePairs = cookieHeader
			.split(";")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
		const cookies = new Map<string, string>();
		for (const pair of cookiePairs) {
			const eqIndex = pair.indexOf("=");
			if (eqIndex > -1) {
				const name = pair.slice(0, eqIndex).trim();
				const value = pair.slice(eqIndex + 1).trim();
				cookies.set(name, value);
			}
		}

		const encodedReturnTo =
			cookies.get("return_to") ||
			new URL(c.req.url).searchParams.get("redirect") ||
			"";
		const returnTo = encodedReturnTo
			? decodeURIComponent(encodedReturnTo)
			: "/authorize";

		// Clear the cookie while redirecting
		const isHttps = new URL(c.req.url).protocol === "https:";
		const clearCookie =
			`return_to=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` +
			(isHttps ? "; Secure" : "");
		console.log("/auth/login: authenticated, redirecting back", { returnTo });
		const res = c.redirect(returnTo || "/authorize");
		res.headers.append("Set-Cookie", clearCookie);
		return res;
	});

	// Reverse proxy the service that's providing the standard API
	app.all("*", async (c) => {
		const url = new URL(c.req.url);

		// If the path is /.well-known return a 404 early
		if (url.pathname.startsWith("/.well-known")) {
			return new Response(null, {
				status: 404,
				statusText: "Not Found",
				headers: {
					"Content-Type": "text/plain",
				},
			});
		}

		// If authenticated and we have a stored return_to, bounce back before proxying
		try {
			const user = await authAdapter.getUser(c);

			const cookieHeader = c.req.raw.headers.get("Cookie") ?? "";
			const cookiePairs = cookieHeader
				.split(";")
				.map((s) => s.trim())
				.filter((s) => s.length > 0);
			const cookies = new Map<string, string>();
			for (const pair of cookiePairs) {
				const eqIndex = pair.indexOf("=");
				if (eqIndex > -1) {
					const name = pair.slice(0, eqIndex).trim();
					const value = pair.slice(eqIndex + 1).trim();
					cookies.set(name, value);
				}
			}
			const redirectParam = url.searchParams.get("redirect") || "";
			const encodedReturnTo = cookies.get("return_to") || redirectParam || "";

			if (user && encodedReturnTo) {
				const returnTo = decodeURIComponent(encodedReturnTo);
				const isHttps = url.protocol === "https:";
				const clearCookie =
					`return_to=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` +
					(isHttps ? "; Secure" : "");
				console.log(
					"catch-all: authenticated with return_to, redirecting",
					{ returnTo },
				);
				const res = c.redirect(returnTo);
				res.headers.append("Set-Cookie", clearCookie);
				return res;
			}
		} catch (e) {
			console.error("catch-all: redirect check failed", e);
		}

		const targetUrl = new URL(url.pathname + url.search, config.proxyTargetUrl);

		// Forward all headers except host
		const headers = new Headers();
		for (const [key, value] of c.req.raw.headers) {
			if (key.toLowerCase() !== "host") {
				headers.set(key, value);
			}
		}

		// Read the body into a buffer if it exists
		let body: ArrayBuffer | null = null;
		if (c.req.method !== "GET" && c.req.method !== "HEAD") {
			body = await c.req.arrayBuffer();
		}

		// Create the proxied request
		const proxyRequest = new Request(targetUrl.toString(), {
			method: c.req.method,
			headers,
			body,
		});

		try {
			// Forward the request to the proxy target
			const response = await fetch(proxyRequest);

			// Create response with same status and headers
			const responseHeaders = new Headers(response.headers);

			// Return the proxied response
			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: responseHeaders,
			});
		} catch (error) {
			console.error("Proxy request failed:", error);
			return c.text("Internal Server Error", 500);
		}
	});

	return app;
}

