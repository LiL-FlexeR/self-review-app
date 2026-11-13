import type { TProjectWorkspace } from '@app/pages/project/use-project-workspace';
import { Button } from '@app/components/ui/Button';
import { Input } from '@app/components/ui/Input';
import { Label } from '@app/components/ui/Label';

export function SyncControls({ workspace }: { workspace: TProjectWorkspace }) {
	const { startDate, setStart, endDate, setEnd, generateReview, setGenerate, busy, startSync } =
		workspace;
	return (
		<form
			className="@container/sync space-y-4"
			onSubmit={(event) => {
				event.preventDefault();
				startSync();
			}}
		>
			<p className="text-sm text-muted-foreground">
				All statuses and assignees, selected by task creation dates in UTC. Current data is
				not a historical work log. Synchronization includes model analysis and may incur
				usage even without a self-review.
			</p>
			<div className="grid gap-4 @min-[360px]/sync:grid-cols-2">
				<div className="min-w-0 space-y-2">
					<Label htmlFor="start">Start date (UTC)</Label>
					<Input
						id="start"
						type="date"
						required
						value={startDate}
						onChange={(event) => setStart(event.target.value)}
					/>
				</div>
				<div className="min-w-0 space-y-2">
					<Label htmlFor="end">End date, inclusive (UTC)</Label>
					<Input
						id="end"
						type="date"
						required
						min={startDate}
						value={endDate}
						onChange={(event) => setEnd(event.target.value)}
					/>
				</div>
			</div>
			<label className="flex items-start gap-3 text-sm">
				<input
					className="mt-1"
					type="checkbox"
					checked={generateReview}
					onChange={(event) => setGenerate(event.target.checked)}
				/>
				Create self-review after synchronization
			</label>
			<Button disabled={busy}>Synchronize project</Button>
		</form>
	);
}
