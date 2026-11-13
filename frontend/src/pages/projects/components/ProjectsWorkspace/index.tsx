import { useCallback, useState } from 'react';
import { Catalog } from '@app/pages/projects/components/Catalog';
import { FilterToolbar } from '@app/pages/projects/components/FilterToolbar';
import { ProjectTable } from '@app/pages/projects/components/ProjectTable';
import { catalogKey, filterProjects } from '@app/pages/projects/catalog';
import type { TCatalogSnapshot, TConnection, TProviderFilter } from '@app/pages/projects/types';

export function ProjectsWorkspace({
	connections,
	userId,
}: {
	connections: TConnection[];
	userId: string;
}) {
	const [search, setSearch] = useState('');
	const [provider, setProvider] = useState<TProviderFilter>('all');
	const [catalogs, setCatalogs] = useState<Record<string, TCatalogSnapshot>>({});
	const updateCatalog = useCallback((key: string, snapshot: TCatalogSnapshot) => {
		setCatalogs((current) =>
			current[key] === snapshot ? current : { ...current, [key]: snapshot },
		);
	}, []);
	const rows = connections.flatMap((connection) =>
		(catalogs[catalogKey(connection)]?.projects ?? []).map((project) => ({
			project,
			connection,
		})),
	);
	const matches = filterProjects(rows, provider, search);
	const relevantConnections = connections.filter(
		(connection) => provider === 'all' || connection.provider === provider,
	);
	const isComplete = relevantConnections.every((connection) => {
		const catalog = catalogs[catalogKey(connection)];
		return (
			catalog &&
			!catalog.isPending &&
			!catalog.isFetching &&
			!catalog.error &&
			!catalog.hasLoop &&
			!catalog.hasNextPage
		);
	});
	const isLoading = relevantConnections.some((connection) => {
		const catalog = catalogs[catalogKey(connection)];
		return !catalog || (catalog.isPending && catalog.isFetching);
	});
	let emptyMessage =
		'No loaded projects match these filters. Try a different search or clear the filters.';
	if (isLoading) {
		emptyMessage = 'Loading project catalogs…';
	} else if (!isComplete) {
		emptyMessage =
			'No matching projects loaded yet. Continue discovery or retry a connection below.';
	} else if (!search.trim() && provider === 'all') {
		emptyMessage = 'No accessible projects were returned by your connected sources.';
	} else if (relevantConnections.length === 0) {
		emptyMessage =
			'No connection for this provider. Choose All providers or manage your connections.';
	}

	return (
		<div className="min-w-0 space-y-6">
			<FilterToolbar
				search={search}
				provider={provider}
				onSearch={setSearch}
				onProvider={setProvider}
			/>
			<div className="space-y-2 text-ui">
				<p role="status" aria-atomic="true">
					{matches.length} matches in {rows.length} loaded projects
				</p>
				<p id="project-search-scope" className="text-muted-foreground">
					Search covers loaded names, source IDs, locations and connection names.
				</p>
				{!isComplete && (
					<p className="flex items-start gap-2 text-muted-foreground">
						More projects may be available. Load remaining pages to broaden this search.
					</p>
				)}
			</div>
			<ProjectTable rows={matches} emptyMessage={emptyMessage} isLoading={isLoading} />
			<section aria-labelledby="catalog-discovery-heading" className="min-w-0 space-y-2">
				<h2 id="catalog-discovery-heading" className="text-component font-medium">
					Catalog discovery
				</h2>
				<p className="text-metadata text-muted-foreground">
					Each connection loads independently. Filters keep all loaded pages available.
				</p>
				<ul className="divide-y border-t border-b">
					{connections.map((connection) => (
						<Catalog
							key={catalogKey(connection)}
							connection={connection}
							userId={userId}
							onChange={updateCatalog}
						/>
					))}
				</ul>
			</section>
		</div>
	);
}
