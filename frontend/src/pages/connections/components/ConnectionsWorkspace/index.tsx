import { Link } from 'react-router';
import { ArrowRight, Link2, Plus } from 'lucide-react';
import { Button } from '@app/components/ui/Button';
import { EmptyState } from '@app/components/templates/EmptyState';
import { ErrorState } from '@app/components/templates/ErrorState';
import { LoadingState } from '@app/components/templates/LoadingState';
import { Status } from '@app/components/ui/Status';
import { ConnectionRow } from '@app/pages/connections/components/ConnectionRow';
import { ConnectionDialog } from '@app/pages/connections/components/ConnectionDialog';
import { DeleteConnectionDialog } from '@app/pages/connections/components/DeleteConnectionDialog';
import {
	LIVE_PROVIDERS,
	providerLabel,
	isLiveProvider,
	type TConnection,
} from '@app/pages/connections/connection-presentation';
import { useConnectionsWorkspace } from '@app/pages/connections/use-connections-workspace';

export function ConnectionsWorkspace({
	userId,
	mode,
}: {
	userId: string;
	mode: 'offline' | 'demo' | 'live';
}) {
	const workspace = useConnectionsWorkspace(userId);
	const {
		connections,
		form,
		deleting,
		feedback,
		busy,
		save,
		add,
		remove,
		managedId,
		setManagedId,
		openForm,
		openDeletion,
	} = workspace;
	const items = connections.data?.items ?? [];
	const fixture = items.find((connection) => connection.provider === 'fixture');
	const hasFixtureAction = connections.data?.availableProviders.includes('fixture');
	const hasLiveActions = LIVE_PROVIDERS.some(
		(provider) =>
			connections.data?.availableProviders.includes(provider) ||
			items.some((connection) => connection.provider === provider),
	);

	function manage(connection: TConnection) {
		setManagedId(connection.id);
		requestAnimationFrame(() => {
			const row = document.getElementById(`connection-${connection.id}`);
			row?.scrollIntoView({ block: 'nearest' });
			row?.querySelector<HTMLButtonElement>('[aria-expanded]')?.focus({
				preventScroll: true,
			});
		});
	}

	return (
		<div className="space-y-8">
			{connections.isPending && (
				<LoadingState reserveSpace>
					Loading available providers and connections…
				</LoadingState>
			)}
			{connections.error && (
				<ErrorState
					error={connections.error}
					title="Connections unavailable"
					onRetry={() => void connections.refetch()}
					retryLabel="Retry loading connections"
					isRetrying={connections.isFetching}
				>
					Saved connection rows remain available when already loaded.
				</ErrorState>
			)}
			{connections.data && (
				<>
					<section aria-label="Provider connections" className="space-y-3">
						{hasLiveActions && (
							<div className="flex flex-wrap gap-3">
								{LIVE_PROVIDERS.map((provider) => {
									const existing = items.find(
										(connection) => connection.provider === provider,
									);
									if (
										!existing &&
										!connections.data.availableProviders.includes(provider)
									) {
										return null;
									}
									return (
										<Button
											key={provider}
											variant="outline"
											disabled={!existing && busy}
											onClick={() =>
												existing ? manage(existing) : openForm(provider)
											}
										>
											<Link2 aria-hidden="true" />
											{existing ? 'Manage' : 'Connect'}{' '}
											{providerLabel(provider)}
										</Button>
									);
								})}
							</div>
						)}
						{hasFixtureAction && (
							<>
								<Button
									variant="outline"
									disabled={!fixture && busy}
									aria-busy={add.isPending}
									onClick={() => {
										if (fixture) {
											manage(fixture);
										} else {
											add.mutate();
										}
									}}
								>
									{fixture ? (
										<Link2 aria-hidden="true" />
									) : (
										<Plus aria-hidden="true" />
									)}
									{fixture
										? 'Manage demo source'
										: add.isPending
											? 'Adding demo source…'
											: 'Add demo source'}
								</Button>
								<p className="text-sm text-muted-foreground">
									Synthetic tracker data ·{' '}
									{mode === 'offline' ? 'scripted model' : 'live OpenAI model'}.
									Live tracker connections are available in live mode.
								</p>
							</>
						)}
						{hasLiveActions && (
							<p className="text-sm text-muted-foreground">
								One personal account per provider. Your verified tracker identity
								becomes the review subject.
							</p>
						)}
					</section>
					{save.isPending && !form && (
						<Status variant="loading">
							Verifying credentials… The request continues after closing the dialog.
						</Status>
					)}
					{remove.isPending && !deleting && (
						<Status variant="loading">Deleting local connection data…</Status>
					)}
					{feedback && !form && !deleting && (
						<Status variant={feedback.variant}>{feedback.message}</Status>
					)}
					<section aria-labelledby="connected-accounts-heading" className="space-y-4">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<h2
								id="connected-accounts-heading"
								tabIndex={-1}
								className="text-section"
							>
								Connected accounts
							</h2>
							{!!items.length && (
								<Button asChild variant="ghost">
									<Link to="/projects">
										Browse projects <ArrowRight aria-hidden="true" />
									</Link>
								</Button>
							)}
						</div>
						{items.length ? (
							<>
								<p className="text-sm text-muted-foreground">
									Verification records the last successful credential check. It
									does not guarantee current tracker availability.
								</p>
								<ul className="divide-y border-y">
									{items.map((connection) => (
										<ConnectionRow
											key={connection.id}
											connection={connection}
											isExpanded={managedId === connection.id}
											busy={busy}
											onManage={() =>
												setManagedId(
													managedId === connection.id
														? undefined
														: connection.id,
												)
											}
											onReplace={() => {
												if (isLiveProvider(connection.provider)) {
													openForm(connection.provider, connection);
												}
											}}
											onDelete={() => openDeletion(connection)}
										/>
									))}
								</ul>
							</>
						) : (
							<EmptyState title="No connected accounts yet">
								{hasFixtureAction
									? 'Add the demo source above to explore projects with synthetic evidence.'
									: 'Choose a provider above to connect your work. Projects and saved evidence will appear after you connect.'}
							</EmptyState>
						)}
					</section>
				</>
			)}
			<ConnectionDialog workspace={workspace} />
			<DeleteConnectionDialog workspace={workspace} />
		</div>
	);
}
