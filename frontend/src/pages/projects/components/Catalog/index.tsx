import { useEffect, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Check, ChevronDown, LoaderCircle, RotateCw, TriangleAlert } from 'lucide-react';
import { ProjectView, pageOf } from '@self-review/contracts';
import { read } from '@app/lib/api';
import { Button } from '@app/components/ui/Button';
import { catalogKey, projectProviderLabel, uniqueProjects } from '@app/pages/projects/catalog';
import type { TCatalogSnapshot, TConnection } from '@app/pages/projects/types';
import { catalogContinuation } from './pagination';

export function Catalog({
	connection,
	userId,
	onChange,
}: {
	connection: TConnection;
	userId: string;
	onChange: (key: string, snapshot: TCatalogSnapshot) => void;
}) {
	const catalog = useInfiniteQuery({
		queryKey: [userId, 'catalog', connection.id],
		initialPageParam: null as string | null,
		queryFn: ({ signal, pageParam }) =>
			read(
				`/connections/${connection.id}/projects${pageParam === null ? '' : `?cursor=${encodeURIComponent(pageParam)}`}`,
				pageOf(ProjectView),
				signal,
			),
		getNextPageParam: (_lastPage, pages, _lastParam, pageParams) =>
			catalogContinuation(pages, pageParams).nextCursor,
		retry: false,
	});
	const snapshot = useMemo<TCatalogSnapshot>(() => {
		const pages = catalog.data?.pages ?? [];
		const { hasLoop } = catalogContinuation(pages, catalog.data?.pageParams ?? []);
		return {
			projects: uniqueProjects(pages.flatMap((page) => page.items)),
			isPending: catalog.isPending,
			isFetching: catalog.isFetching,
			hasNextPage: catalog.hasNextPage,
			hasLoop,
			error: catalog.error,
		};
	}, [catalog.data, catalog.isPending, catalog.isFetching, catalog.hasNextPage, catalog.error]);

	// Keep queries mounted independently of filters; the table receives a read-only projection.
	useEffect(() => {
		onChange(catalogKey(connection), snapshot);
	}, [connection, onChange, snapshot]);

	const isComplete =
		!snapshot.isPending && !snapshot.error && !snapshot.hasNextPage && !snapshot.hasLoop;
	let Icon = Check;
	if (snapshot.error || snapshot.hasLoop) {
		Icon = TriangleAlert;
	} else if (snapshot.hasNextPage) {
		Icon = ChevronDown;
	}
	let state = 'Catalog complete';
	if (snapshot.isPending) {
		state = 'Loading catalog…';
	} else if (snapshot.error) {
		state = 'Discovery incomplete';
	} else if (snapshot.hasLoop) {
		state = 'Pagination did not advance · discovery incomplete';
	} else if (snapshot.hasNextPage) {
		state = 'More projects available';
	} else if (snapshot.isFetching) {
		state = 'Refreshing catalog…';
	}
	const needsRetry = !!snapshot.error || snapshot.hasLoop;
	let actionLabel = needsRetry ? 'Retry catalog' : 'Load more projects';
	if (snapshot.isFetching) {
		actionLabel = 'Loading projects…';
	}

	return (
		<li className="flex min-w-0 flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
			<div className="min-w-0 space-y-1 text-ui wrap-anywhere">
				<p className="font-medium">
					{projectProviderLabel(connection.provider)}
					<span className="font-normal text-muted-foreground">
						{' '}
						· {connection.displayName}
					</span>
				</p>
				<p role="status" className="flex items-start gap-2 text-muted-foreground">
					{snapshot.isFetching ? (
						<LoaderCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
					) : (
						<Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
					)}
					<span>
						{snapshot.projects.length} loaded · {state}
						{isComplete &&
							snapshot.projects.length === 0 &&
							'. No accessible projects.'}
					</span>
				</p>
				{snapshot.error && (
					<p role="alert" className="text-error">
						{snapshot.error.message} Loaded projects remain available.
					</p>
				)}
			</div>
			{(needsRetry || snapshot.hasNextPage) && (
				<Button
					variant="outline"
					size="sm"
					disabled={snapshot.isFetching}
					aria-busy={snapshot.isFetching}
					aria-label={`${actionLabel} for ${connection.displayName} (${projectProviderLabel(connection.provider)})`}
					onClick={() => {
						if (
							snapshot.hasLoop ||
							!catalog.data ||
							(snapshot.error && !catalog.isFetchNextPageError)
						) {
							void catalog.refetch();
						} else {
							void catalog.fetchNextPage();
						}
					}}
				>
					{needsRetry ? (
						<RotateCw aria-hidden="true" />
					) : (
						<ChevronDown aria-hidden="true" />
					)}
					{actionLabel}
				</Button>
			)}
		</li>
	);
}
