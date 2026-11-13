import type { TConnection, TProject, TProjectRow, TProviderFilter } from './types';

export const PROJECT_PROVIDERS = [
	{ value: 'all', label: 'All providers' },
	{ value: 'linear', label: 'Linear' },
	{ value: 'clickup', label: 'ClickUp' },
	{ value: 'jira', label: 'Jira Cloud' },
] as const;

export function projectProviderLabel(provider: string) {
	if (provider === 'fixture') {
		return 'Synthetic demo source';
	}
	return PROJECT_PROVIDERS.find((option) => option.value === provider)?.label ?? provider;
}

export function catalogKey(connection: TConnection) {
	return `${connection.id}/${connection.verifiedAt}`;
}

export function uniqueProjects(projects: TProject[]) {
	return [...new Map(projects.map((project) => [project.id, project])).values()];
}

export function filterProjects(rows: TProjectRow[], provider: TProviderFilter, search: string) {
	const query = search.trim().toLowerCase();
	return rows.filter(({ project, connection }) => {
		if (provider !== 'all' && connection.provider !== provider) {
			return false;
		}
		return [
			project.name,
			project.externalId,
			project.breadcrumb.join(' / '),
			connection.displayName,
		].some((value) => value.toLowerCase().includes(query));
	});
}
