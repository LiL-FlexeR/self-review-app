import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router';
import type { z as zod } from 'zod';
import type { ConnectionView } from '@self-review/contracts';
import { auth, queryClient } from '@app/auth/session';
import { Button } from '@app/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@app/components/ui/Card';
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
	SheetFooter,
	SheetClose,
} from '@app/components/ui/Sheet';
import { Status } from '@app/components/ui/Status';
import { ProviderForm } from '@app/pages/connections/components/ProviderForm';

export function ConnectionCard({
	connection,
	userId,
}: {
	connection: zod.infer<typeof ConnectionView>;
	userId: string;
}) {
	const [isReplacing, setReplacing] = useState(false);
	const [isDeleting, setDeleting] = useState(false);
	const remove = useMutation({
		retry: false,
		mutationFn: () =>
			auth.request(`/connections/${connection.id}`, {
				method: 'DELETE',
				body: JSON.stringify({ confirm: true }),
			}),
		onSuccess: async () => {
			setDeleting(false);
			queryClient.removeQueries({ queryKey: [userId, 'catalog', connection.id] });
			await queryClient.invalidateQueries({ queryKey: [userId] });
		},
	});
	return (
		<Card className="min-w-0">
			<CardHeader>
				<CardTitle className="wrap-anywhere">{connection.displayName}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4 wrap-anywhere">
				<p className="text-sm text-muted-foreground">
					{connection.provider} · {connection.mode} data · {connection.modelMode} model ·{' '}
					{connection.status}
				</p>
				<p>
					Tracker token owner: {connection.sourceUserName} ({connection.sourceUserId})
				</p>
				{connection.warnings.map((warning) => (
					<Status key={warning}>{warning}</Status>
				))}
				<p className="text-sm">
					Verified {new Date(connection.verifiedAt).toLocaleString()}
				</p>
				<Link className="underline" to="/projects">
					Browse projects
				</Link>
				{(connection.provider === 'linear' ||
					connection.provider === 'clickup' ||
					connection.provider === 'jira') && (
					<>
						<p className="text-sm text-muted-foreground">
							One connection per provider per account. Replacement requires the same
							tracker user
							{connection.provider === 'linear'
								? ' and workspace'
								: connection.provider === 'jira'
									? ' and cloudId'
									: ''}
							. To switch accounts, explicitly delete this connection first.
						</p>
						<Button
							variant="outline"
							onClick={() => setReplacing(!isReplacing)}
							aria-expanded={isReplacing}
						>
							{isReplacing ? 'Cancel replacement' : 'Replace credentials'}
						</Button>
						{isReplacing && (
							<ProviderForm
								userId={userId}
								connectionId={connection.id}
								provider={connection.provider}
							/>
						)}
					</>
				)}
				<Button
					variant="outline"
					onClick={() => {
						remove.reset();
						setDeleting(true);
					}}
				>
					Delete local connection
				</Button>
				<Sheet open={isDeleting} onOpenChange={setDeleting}>
					<SheetContent className="overflow-y-auto">
						<SheetHeader>
							<SheetTitle>Delete {connection.displayName}?</SheetTitle>
							<SheetDescription>
								This permanently deletes the local key, projects, snapshots and
								reports for this connection.{' '}
								{connection.provider !== 'fixture'
									? 'The personal token in the tracker is not revoked.'
									: 'The synthetic source can be added again.'}{' '}
								Deletion is blocked while a job is active.
							</SheetDescription>
						</SheetHeader>
						{remove.error && (
							<div className="px-4">
								<Status>{remove.error.message}</Status>
							</div>
						)}
						<SheetFooter>
							<SheetClose asChild>
								<Button variant="outline" disabled={remove.isPending}>
									Cancel
								</Button>
							</SheetClose>
							<Button disabled={remove.isPending} onClick={() => remove.mutate()}>
								{remove.isPending ? 'Deleting…' : 'Permanently delete local data'}
							</Button>
						</SheetFooter>
					</SheetContent>
				</Sheet>
			</CardContent>
		</Card>
	);
}
