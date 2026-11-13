import { describe, expect, it } from 'vitest';
import { catalogKey, filterProjects, projectProviderLabel, uniqueProjects } from './catalog';
import type { TProjectRow } from './types';

function catalogRow(id: string, provider: string, connectionId = 'connection-one'): TProjectRow {
	return {
		project: {
			id,
			connectionId,
			externalId: 'REMOTE-42',
			name: 'Shared platform',
			resourceType: 'project',
			breadcrumb: ['Engineering', 'Reliability'],
		},
		connection: {
			id: connectionId,
			provider,
			mode: provider === 'fixture' ? 'fixture' : 'live',
			modelMode: 'scripted',
			displayName: 'Personal workspace',
			sourceUserId: 'synthetic-owner',
			sourceUserName: 'Synthetic owner',
			status: 'active',
			verifiedAt: '2026-11-13T10:00:00Z',
			warnings: [],
		},
	};
}

describe('loaded project discovery', () => {
	it.each([' platform ', 'remote-42', 'ENGINEERING / reliability', 'personal WORKSPACE'])(
		'finds loaded resources by the supported search field: %s',
		(search) => {
			const row = catalogRow('local-one', 'linear');
			expect(filterProjects([row], 'all', search)).toEqual([row]);
		},
	);

	it('keeps matching remote identities from different connections distinct', () => {
		const first = catalogRow('local-one', 'linear');
		const second = catalogRow('local-two', 'linear', 'connection-two');
		const newestFirst = { ...first.project, name: 'Updated loaded name' };
		expect(uniqueProjects([first.project, second.project, newestFirst])).toEqual([
			newestFirst,
			second.project,
		]);
	});

	it('includes synthetic resources under All without adding them to a live provider', () => {
		const fixture = catalogRow('synthetic', 'fixture');
		const linear = catalogRow('linear', 'linear');
		const rows = [fixture, linear];
		expect(filterProjects(rows, 'all', '   ')).toEqual(rows);
		expect(filterProjects(rows, 'linear', '')).toEqual([linear]);
		expect(filterProjects(rows, 'jira', '')).toEqual([]);
		expect(projectProviderLabel('fixture')).toBe('Synthetic demo source');
		expect(rows).toEqual([fixture, linear]);
	});

	it('does not turn no matches into a different loaded catalog', () => {
		const rows = [catalogRow('local-one', 'clickup')];
		expect(filterProjects(rows, 'all', 'not loaded')).toEqual([]);
		expect(filterProjects(rows, 'all', '')).toEqual(rows);
	});

	it('separates discovery projections after connection reverification', () => {
		const connection = catalogRow('local-one', 'jira').connection;
		expect(catalogKey(connection)).not.toBe(
			catalogKey({ ...connection, verifiedAt: '2026-11-13T11:00:00Z' }),
		);
	});
});
