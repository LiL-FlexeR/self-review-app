import { RotateCw, XIcon } from 'lucide-react';
import { Button } from '@app/components/ui/Button';

interface ISelectionToolbarProps {
	count: number;
	busy: boolean;
	onClear: () => void;
	onRefresh: () => void;
}
export function SelectionToolbar({ count, busy, onClear, onRefresh }: ISelectionToolbarProps) {
	if (!count) {
		return null;
	}
	return (
		<div
			className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-control-border bg-selection px-4 py-3"
			role="region"
			aria-label="Selected tasks"
		>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				<p className="text-sm font-medium" role="status">
					{count} selected
				</p>
				<span className="text-sm text-muted-foreground">Across pages in this snapshot</span>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Button variant="ghost" size="sm" onClick={onClear}>
					<XIcon aria-hidden="true" />
					Clear selection
				</Button>
				<Button size="sm" disabled={busy} onClick={onRefresh}>
					<RotateCw aria-hidden="true" />
					Refresh selected ({count})
				</Button>
			</div>
			{busy && (
				<p className="w-full text-sm text-muted-foreground">
					Another command is pending or running. Refresh is available after it finishes.
				</p>
			)}
		</div>
	);
}
