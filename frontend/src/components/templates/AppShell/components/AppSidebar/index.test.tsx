import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { TIdentity } from '@self-review/contracts';
import { SidebarProvider } from '@app/components/ui/Sidebar';
import { AppSidebar } from '@app/components/templates/AppShell/components/AppSidebar';

const IDENTITY: TIdentity = {
	user: {
		id: '11111111-1111-4111-8111-111111111111',
		email: 'long.synthetic.application.account@example.test',
	},
	sid: '22222222-2222-4222-8222-222222222222',
	csrfToken: 'synthetic-test-token',
	accessExpiresAt: '2026-11-13T16:00:00Z',
	sessionExpiresAt: '2026-11-14T16:00:00Z',
	mode: 'offline',
};

function renderSidebar(pathname: string, busy = false) {
	return renderToStaticMarkup(
		createElement(
			MemoryRouter,
			{ initialEntries: [pathname] },
			createElement(
				SidebarProvider,
				null,
				createElement(AppSidebar, { user: IDENTITY, busy, onLogout: () => undefined }),
			),
		),
	);
}

describe('Application sidebar', () => {
	it('keeps project deep links under Projects without adding global navigation', () => {
		const markup = renderSidebar('/projects/synthetic-project?snapshot=synthetic-snapshot');
		const navigation = markup.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/)?.[0] ?? '';
		const projectLink = navigation.match(/<a\b[^>]*href="\/projects"[^>]*>/)?.[0] ?? '';

		expect(navigation.match(/<a\b/g)).toHaveLength(2);
		expect(navigation).toContain('href="/connections"');
		expect(projectLink).toContain('aria-current="page"');
		expect(projectLink).toContain('data-active="true"');
	});

	it('keeps account identity and accurate session guidance accessible with busy sign-out', () => {
		const markup = renderSidebar('/connections', true);

		expect(markup).toContain(IDENTITY.user.email);
		expect(markup).toContain('Application account');
		expect(markup).toContain('<summary');
		expect(markup).toContain('Account and session help');
		expect(markup).toContain('Issued access tokens expire within 15');
		expect(markup).toContain('Accepted background work continues after sign-out.');
		expect(markup).toMatch(/<button\b[^>]*disabled=""[^>]*>/);
		expect(markup).toContain('Signing out…');
	});
});
