// Helper to generate the layout
import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import type { AuthRequest } from "@cloudflare/workers-oauth-provider";

// This file mainly exists as a dumping ground for uninteresting html and CSS
// to remove clutter and noise from the auth logic. You likely do not need
// anything from this file.

export const layout = (content: HtmlEscapedString | string, companyName: string) => html`
	<!DOCTYPE html>
	<html lang="en">
		<head>
			<meta charset="UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<title>${companyName} - MCP Authorization</title>
			<script src="https://cdn.tailwindcss.com"></script>
			<script>
				tailwind.config = {
					theme: {
						extend: {
							colors: {
								primary: "#111827", // near-black akin to gray-900
								secondary: "#0ea5e9", // sky-500
								accent: "#22c55e", // green-500
							},
							fontFamily: {
								sans: ["Inter", "system-ui", "sans-serif"],
								heading: ["Roboto", "system-ui", "sans-serif"],
							},
						},
					},
				};
			</script>
			<style>
				@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap");
			</style>
		</head>
		<body
			class="bg-gray-50 text-gray-800 font-sans leading-relaxed flex flex-col min-h-screen"
		>
			<main class="container mx-auto px-4 py-10 flex-grow flex items-center justify-center">${content}</main>
			<footer class="py-6 mt-4">
				<div class="container mx-auto px-4 text-center text-gray-500 text-xs">
					<p>Powered by Famma AI.</p>
				</div>
			</footer>
		</body>
	</html>
`;

export const renderLoggedInAuthorizeScreen = async (
	oauthReqInfo: AuthRequest,
	authorizeUrl: string,
	logoUrl: string,
	companyName: string,
) => {
	return html`
		<div class="w-full max-w-md mx-auto">
			<div class="flex flex-col items-center text-center mb-6">
				<img
					src="${logoUrl}"
					alt="${companyName}"
					class="h-12 w-12 rounded-md mb-3"
				/>
				<div class="text-2xl font-heading font-bold text-gray-900">${companyName}</div>
			</div>
			<div class="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
				<h1 class="text-xl font-semibold mb-4 text-gray-900">Authorization Request</h1>

				<div class="mb-6">
					<h2 class="text-lg font-semibold mb-3 text-gray-800">
						Stack AI would like permission to:
					</h2>
					<ul class="space-y-4">
						<li class="flex items-start gap-3">
							<svg class="h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<path d="M20 21v-2a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v2" />
								<circle cx="12" cy="7" r="4" />
							</svg>
							<div class="pt-0.5">
								<p class="font-normal text-gray-600">Verify your identity</p>
							</div>
						</li>
						<li class="flex items-start gap-3">
							<svg class="h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
								<polyline points="14 2 14 8 20 8" />
							</svg>
							<div class="pt-0.5">
								<p class="font-normal text-gray-600">Know which resources you can access</p>
							</div>
						</li>
						<li class="flex items-start gap-3">
							<svg class="h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
							</svg>
							<div class="pt-0.5">
								<p class="font-normal text-gray-600">Act on your behalf</p>
							</div>
						</li>
					</ul>
				</div>
				<form action="/approve" method="POST" class="space-y-3">
				<input
					type="hidden"
					name="oauthReqInfo"
					value="${JSON.stringify(oauthReqInfo)}"
				/>
				<input type="hidden" name="authorizeUrl" value="${authorizeUrl}" />
				<input type="hidden" name="email" value="user@example.com" />
				<button
					type="submit"
					name="action"
					value="approve"
						class="w-full py-3 px-4 bg-black text-white rounded-md font-medium hover:bg-black/90 transition-colors"
				>
					Approve
				</button>
				<button
					type="submit"
					name="action"
					value="reject"
						class="w-full py-3 px-4 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50 transition-colors"
				>
					Reject
				</button>
				</form>
			</div>
		</div>
	`;
};

export const renderLoggedOutAuthorizeScreen = async (
	oauthReqInfo: AuthRequest,
	authorizeUrl: string,
	logoUrl: string,
	companyName: string,
) => {
	return html`
		<div class="w-full max-w-md mx-auto">
			<div class="flex flex-col items-center text-center mb-6">
				<img
					src="${logoUrl}"
					alt="${companyName}"
					class="h-12 w-12 rounded-md mb-3"
				/>
				<div class="text-2xl font-heading font-bold text-gray-900">${companyName}</div>
			</div>
			<div class="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
				<h1 class="text-xl font-semibold mb-4 text-gray-900">Authorization Request</h1>

				<div class="mb-6">
					<h2 class="text-lg font-semibold mb-3 text-gray-800">
						${companyName} would like permission to:
					</h2>
					<ul class="space-y-4">
						<li class="flex items-start gap-3">
							<svg class="h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<path d="M20 21v-2a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v2" />
								<circle cx="12" cy="7" r="4" />
							</svg>
							<div class="pt-0.5">
								<p class="font-normal text-gray-600">Verify your identity</p>
							</div>
						</li>
						<li class="flex items-start gap-3">
							<svg class="h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
								<polyline points="14 2 14 8 20 8" />
							</svg>
							<div class="pt-0.5">
								<p class="font-normal text-gray-600">Know which resources you can access</p>
							</div>
						</li>
						<li class="flex items-start gap-3">
							<svg class="h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
							</svg>
							<div class="pt-0.5">
								<p class="font-normal text-gray-600">Act on your behalf</p>
							</div>
						</li>
					</ul>
				</div>
				<form action="/approve" method="POST" class="space-y-3">
				<input
					type="hidden"
					name="oauthReqInfo"
					value="${JSON.stringify(oauthReqInfo)}"
				/>
				<input type="hidden" name="authorizeUrl" value="${authorizeUrl}" />
				<div class="space-y-4">
					<div>
						<label
							for="email"
							class="block text-sm font-medium text-gray-700 mb-1"
							>Email</label
						>
						<input
							type="email"
							id="email"
							name="email"
							required
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
						/>
					</div>
					<div>
						<label
							for="password"
							class="block text-sm font-medium text-gray-700 mb-1"
							>Password</label
						>
						<input
							type="password"
							id="password"
							name="password"
							required
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
						/>
					</div>
				</div>
				<button
					type="submit"
					name="action"
					value="login_approve"
						class="w-full py-3 px-4 bg-black text-white rounded-md font-medium hover:bg-black/90 transition-colors"
				>
					Log in and Approve
				</button>
				<button
					type="submit"
					name="action"
					value="reject"
						class="w-full py-3 px-4 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50 transition-colors"
				>
					Reject
				</button>
				</form>
			</div>
		</div>
	`;
};

export const renderApproveContent = async (
	message: string,
	status: string,
	redirectUrl: string,
) => {
	return html`
		<div class="max-w-md mx-auto bg-white p-8 rounded-lg shadow-md text-center">
			<div class="mb-4">
				<span
					class="inline-flex h-10 w-10 items-center justify-center ${
						status === "success"
							? "bg-green-100 text-green-800"
							: "bg-red-100 text-red-800"
					} rounded-full"
				>
					${status === "success" ? "✓" : "✗"}
				</span>
			</div>
			<h1 class="text-2xl font-heading font-bold mb-4 text-gray-900">
				${message}
			</h1>
			<p class="mb-8 text-gray-600">
				You will be redirected back to the application shortly.
			</p>
			<a
				href="/"
				class="inline-block py-2 px-4 bg-primary text-white rounded-md font-medium hover:bg-primary/90 transition-colors"
			>
				Return to Home
			</a>
			${raw(`
				<script>
					setTimeout(() => {
						window.location.href = "${redirectUrl}";
					}, 2000);
				</script>
			`)}
		</div>
	`;
};

export const renderAuthorizationApprovedContent = async (redirectUrl: string) => {
	return renderApproveContent("Authorization approved!", "success", redirectUrl);
};

export const renderAuthorizationRejectedContent = async (redirectUrl: string) => {
	return renderApproveContent("Authorization rejected.", "error", redirectUrl);
};

export const renderAuthorizationRejectedPage = async (authorizeUrl: string, companyName: string) => {
	return html`
		<div class="max-w-md mx-auto bg-white p-8 rounded-lg shadow-md text-center">
			<div class="mb-4">
				<span class="inline-flex h-10 w-10 items-center justify-center bg-red-100 text-red-800 rounded-full">✗</span>
			</div>
			<h1 class="text-2xl font-heading font-bold mb-4 text-gray-900">
				Authorization required
			</h1>
			<p class="mb-8 text-gray-600">
				If you don't accept permissions, you won't be able to use ${companyName}.
			</p>
			<a
				href="${authorizeUrl || "/authorize"}"
				class="inline-block py-2 px-4 bg-black text-white rounded-md font-medium hover:bg-black/90 transition-colors"
			>
				Go back to authorize
			</a>
		</div>
	`;
};

export const parseApproveFormBody = async (body: { [x: string]: string | File }) => {
	const action = body.action as string;
	const email = body.email as string;
	const password = body.password as string;
	const authorizeUrl = body.authorizeUrl as string;
	let oauthReqInfo: AuthRequest | null = null;
	try {
		oauthReqInfo = JSON.parse(body.oauthReqInfo as string) as AuthRequest;
	} catch (_e) {
		oauthReqInfo = null;
	}

	return { action, oauthReqInfo, email, password, authorizeUrl };
};
