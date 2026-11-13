import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { expect, it } from 'vitest';
import type { TIdentity } from '@self-review/contracts';
import { AppShellLayout } from '@app/components/templates/AppShell/components/AppShellLayout';

it.each([
	['offline', 'Synthetic source', 'scripted model'],
	['demo', 'Synthetic source', 'live model'],
	['live', 'Trackers enabled', 'live model'],
] as const)(
	'labels the %s runtime without conflating source and model modes',
	(mode, source, model) => {
		const user: TIdentity = {
			user: { id: '11111111-1111-4111-8111-111111111111', email: 'synthetic@example.test' },
			sid: '22222222-2222-4222-8222-222222222222',
			csrfToken: 'synthetic-test-token',
			accessExpiresAt: '2026-11-13T16:00:00Z',
			sessionExpiresAt: '2026-11-14T16:00:00Z',
			mode,
		};
		const markup = renderToStaticMarkup(
			createElement(
				MemoryRouter,
				null,
				createElement(AppShellLayout, {
					user,
					title: 'Synthetic project',
					busy: false,
					onLogout: () => undefined,
					children: 'Saved content',
				}),
			),
		);

		expect(markup).toContain('aria-label="Runtime mode"');
		expect(markup).toContain(source);
		expect(markup).toContain(model);
		expect(markup.match(/<main\b/g)).toHaveLength(1);
		expect(markup).toMatch(/<main\b[^>]*id="content"[^>]*tabindex="-1"/);
		expect(markup).toContain('href="#content"');
		expect(markup).toContain('Saved content');
	},
);
