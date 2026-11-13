import { useRef } from 'react';
import { Trash2 } from 'lucide-react';
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogAction,
	AlertDialogCancel,
} from '@app/components/ui/AlertDialog';
import { Status } from '@app/components/ui/Status';
import type { TConnectionsWorkspace } from '@app/pages/connections/use-connections-workspace';

export function DeleteConnectionDialog({ workspace }: { workspace: TConnectionsWorkspace }) {
	const { deleting, setDeleting, remove } = workspace;
	const opener = useRef<HTMLElement | null>(null);
	const cancel = useRef<HTMLButtonElement>(null);
	return (
		<AlertDialog
			open={!!deleting}
			onOpenChange={(open) => {
				if (!open) {
					setDeleting(undefined);
				}
			}}
		>
			<AlertDialogContent
				aria-busy={remove.isPending}
				onOpenAutoFocus={(event) => {
					opener.current =
						document.activeElement instanceof HTMLElement
							? document.activeElement
							: null;
					event.preventDefault();
					cancel.current?.focus();
				}}
				onCloseAutoFocus={(event) => {
					if (!opener.current?.isConnected || opener.current === document.body) {
						event.preventDefault();
						document
							.getElementById('connected-accounts-heading')
							?.focus({ preventScroll: true });
					}
				}}
			>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete local connection?</AlertDialogTitle>
					<AlertDialogDescription>
						This permanently removes its local projects, snapshots, tasks, reports and
						credentials. It does not revoke the token or delete projects in your
						tracker.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<div className="space-y-4 text-sm">
					<p className="font-medium wrap-anywhere">{deleting?.displayName}</p>
					<p className="text-muted-foreground">
						Deletion is blocked while any job for this connection is active. Wait for it
						to finish, then try again.
					</p>
					{deleting?.provider === 'fixture' && (
						<p className="text-muted-foreground">
							You can add the synthetic source again; its deleted local history will
							not be restored.
						</p>
					)}
					{remove.error && <Status variant="error">{remove.error.message}</Status>}
					{remove.isPending && (
						<p role="status" className="text-muted-foreground">
							Deleting local data… Closing this dialog does not cancel the request.
							Its result will appear on Connections.
						</p>
					)}
				</div>
				<AlertDialogFooter>
					<AlertDialogCancel ref={cancel}>
						{remove.isPending ? 'Close' : 'Cancel'}
					</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={remove.isPending}
						aria-busy={remove.isPending}
						onClick={(event) => {
							event.preventDefault();
							if (deleting && !remove.isPending) {
								remove.mutate(deleting);
							}
						}}
					>
						<Trash2 aria-hidden="true" />
						{remove.isPending ? 'Deleting…' : 'Delete local connection'}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
