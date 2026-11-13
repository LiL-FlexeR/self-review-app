import { Link } from 'react-router';
import { ArrowUpRight, KeyRound, Trash2 } from 'lucide-react';
import { Button } from '@app/components/ui/Button';
import {
	connectionMode,
	isLiveProvider,
	type TConnection,
} from '@app/pages/connections/connection-presentation';

interface IConnectionManagementProps {
	connection: TConnection;
	busy: boolean;
	onReplace: () => void;
	onDelete: () => void;
}

export function ConnectionManagement({
	connection,
	busy,
	onReplace,
	onDelete,
}: IConnectionManagementProps) {
	return (
		<div className="space-y-4 border-t pt-4 text-sm">
			<dl className="grid gap-4 sm:grid-cols-2">
				<div className="min-w-0 space-y-1">
					<dt className="text-muted-foreground">Verified tracker user ID</dt>
					<dd className="font-mono text-identifier wrap-anywhere">
						{connection.sourceUserId}
					</dd>
				</div>
				<div className="space-y-1">
					<dt className="text-muted-foreground">Saved source and model</dt>
					<dd className="wrap-anywhere">{connectionMode(connection)}</dd>
				</div>
			</dl>
			{isLiveProvider(connection.provider) && (
				<p className="max-w-prose text-muted-foreground">
					One connection per provider. Replacement requires the same verified tracker user
					{connection.provider === 'linear' && ' and workspace'}
					{connection.provider === 'jira' && ' and cloudId'}. To switch accounts
					{connection.provider === 'jira' && ' or Jira sites'}, delete this local
					connection first, then connect again.
				</p>
			)}
			<div className="flex flex-wrap items-center gap-2">
				<Button asChild variant="outline">
					<Link to="/projects">
						Browse projects <ArrowUpRight aria-hidden="true" />
					</Link>
				</Button>
				{isLiveProvider(connection.provider) && (
					<Button variant="outline" disabled={busy} onClick={onReplace}>
						<KeyRound aria-hidden="true" />
						Replace credentials
					</Button>
				)}
				<Button variant="ghost" disabled={busy} onClick={onDelete}>
					<Trash2 aria-hidden="true" />
					Delete local connection
				</Button>
			</div>
		</div>
	);
}
