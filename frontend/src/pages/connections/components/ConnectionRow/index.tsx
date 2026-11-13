import { useId } from 'react';
import { ChevronDown, Link2 } from 'lucide-react';
import { Button } from '@app/components/ui/Button';
import { Status } from '@app/components/ui/Status';
import {
	providerLabel,
	verificationDate,
	type TConnection,
} from '@app/pages/connections/connection-presentation';
import { ConnectionManagement } from '@app/pages/connections/components/ConnectionManagement';

interface IConnectionRowProps {
	connection: TConnection;
	isExpanded: boolean;
	busy: boolean;
	onManage: () => void;
	onReplace: () => void;
	onDelete: () => void;
}

export function ConnectionRow({
	connection,
	isExpanded,
	busy,
	onManage,
	onReplace,
	onDelete,
}: IConnectionRowProps) {
	const detailsId = useId();
	return (
		<li className="min-w-0 space-y-4 py-5" id={`connection-${connection.id}`}>
			<div className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3 @min-[640px]/workspace:grid-cols-[2.5rem_minmax(0,1fr)_auto]">
				<div className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-button-quiet border bg-surface">
					<Link2 className="size-4" aria-hidden="true" />
				</div>
				<div className="grid min-w-0 gap-x-6 gap-y-3 @min-[880px]/workspace:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
					<div className="min-w-0 space-y-1">
						<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
							<h3 className="text-ui font-medium">
								{providerLabel(connection.provider)}
							</h3>
							<span className="rounded-chips border px-2 py-0.5 text-metadata wrap-anywhere">
								Stored status: {connection.status}
							</span>
						</div>
						<p className="wrap-anywhere">{connection.displayName}</p>
					</div>
					<div className="min-w-0 space-y-1 text-sm">
						<p className="wrap-anywhere">
							<span className="text-muted-foreground">Verified owner </span>
							{connection.sourceUserName}
						</p>
						<p className="text-muted-foreground">
							Last verified{' '}
							<time dateTime={connection.verifiedAt}>
								{verificationDate(connection.verifiedAt)}
							</time>
						</p>
					</div>
				</div>
				<Button
					variant="ghost"
					className="col-start-2 justify-self-start @min-[640px]/workspace:col-start-3 @min-[640px]/workspace:row-start-1 @min-[640px]/workspace:-mr-2"
					aria-label={`Manage ${providerLabel(connection.provider)} connection ${connection.displayName}`}
					aria-expanded={isExpanded}
					aria-controls={detailsId}
					onClick={onManage}
				>
					<span className="text-nowrap">Manage </span>
					<ChevronDown
						className={isExpanded ? 'rotate-180' : undefined}
						aria-hidden="true"
					/>
				</Button>
			</div>
			{connection.warnings.map((warning) => (
				<Status key={warning} variant="warning">
					{warning}
				</Status>
			))}
			<div id={detailsId} hidden={!isExpanded}>
				{isExpanded && (
					<ConnectionManagement
						connection={connection}
						busy={busy}
						onReplace={onReplace}
						onDelete={onDelete}
					/>
				)}
			</div>
		</li>
	);
}
