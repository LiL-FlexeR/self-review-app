import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ProjectView, pageOf } from '@self-review/contracts';
import { read } from '@app/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@app/components/ui/Card';
import { Status } from '@app/components/ui/Status';
import { Button } from '@app/components/ui/Button';
import { catalogContinuation } from './pagination';

export function Catalog({
	connectionId,
	userId,
	name,
	provider,
}: {
	connectionId: string;
	userId: string;
	name: string;
	provider: string;
}) {
	const catalog = useInfiniteQuery({
		queryKey: [userId, 'catalog', connectionId],
		initialPageParam: null as string | null,
		queryFn: ({ signal, pageParam }) =>
			read(
				`/connections/${connectionId}/projects${pageParam === null ? '' : `?cursor=${encodeURIComponent(pageParam)}`}`,
				pageOf(ProjectView),
				signal,
			),
		getNextPageParam: (_lastPage, pages, _lastParam, pageParams) =>
			catalogContinuation(pages, pageParams).nextCursor,
		retry: false,
	});
	const items = [
		...new Map(
			catalog.data?.pages
				.flatMap((page) => page.items)
				.map((project) => [project.id, project]),
		).values(),
	];
	const { hasLoop } = catalogContinuation(
		catalog.data?.pages ?? [],
		catalog.data?.pageParams ?? [],
	);
	return (
		<Card className="min-w-0">
			<CardHeader>
				<CardTitle>
					{name} · {provider === 'fixture' ? 'Synthetic source' : provider}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4 wrap-anywhere">
				{catalog.isPending && <Status>Loading project catalog…</Status>}
				{catalog.error && (
					<Status>{catalog.error.message} Loaded projects remain available.</Status>
				)}
				{hasLoop && (
					<Status>Project pagination did not advance. Discovery is incomplete.</Status>
				)}
				{items.map((project) => (
					<div key={project.id} className="rounded-xl border p-4">
						<Link className="underline" to={`/projects/${project.id}`}>
							{project.name}
						</Link>
						<p className="text-sm text-muted-foreground">
							{provider} · {project.resourceType} · {project.breadcrumb.join(' / ')}
						</p>
					</div>
				))}
				{catalog.isSuccess && items.length === 0 && !catalog.hasNextPage && !hasLoop && (
					<p>No accessible projects.</p>
				)}
				{catalog.hasNextPage && (
					<Button
						variant="outline"
						disabled={catalog.isFetchingNextPage}
						onClick={() => {
							void catalog.fetchNextPage();
						}}
					>
						{catalog.isFetchingNextPage ? 'Loading projects…' : 'Load more projects'}
					</Button>
				)}
				{catalog.error && (
					<Button
						variant="outline"
						onClick={() => {
							if (catalog.data) {
								void catalog.fetchNextPage();
							} else {
								void catalog.refetch();
							}
						}}
					>
						Retry catalog
					</Button>
				)}
			</CardContent>
		</Card>
	);
}
