import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z as zod } from 'zod';
import { pageOf } from '@self-review/contracts';
import { read } from '@app/lib/api';
import { Button } from '@app/components/ui/Button';
import { Status } from '@app/components/ui/Status';
export function TraceView({ runId, userId }: { runId: string; userId: string }) {
	const [cursor, setCursor] = useState('0');
	const trace = useQuery({
		queryKey: [userId, 'trace', runId, cursor],
		queryFn: ({ signal }) =>
			read(
				`/jobs/${runId}/trace?cursor=${cursor}`,
				pageOf(
					zod.object({
						batchId: zod.string(),
						level: zod.number(),
						events: zod.array(zod.unknown()),
					}),
				),
				signal,
			),
	});
	return (
		<details className="rounded-xl border p-4">
			<summary className="cursor-pointer">Safe execution trace · {runId.slice(0, 8)}</summary>
			<div className="mt-3 space-y-3">
				{trace.isPending && <Status>Loading saved trace…</Status>}
				{trace.error && <Status>{trace.error.message}</Status>}
				<pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs">
					{JSON.stringify(trace.data?.items, null, 2)}
				</pre>
				<div className="flex gap-2">
					{cursor !== '0' && (
						<Button
							variant="outline"
							onClick={() => setCursor(String(Math.max(0, Number(cursor) - 20)))}
						>
							Previous units
						</Button>
					)}
					{trace.data?.nextCursor && (
						<Button
							variant="outline"
							onClick={() => setCursor(trace.data!.nextCursor!)}
						>
							Next units
						</Button>
					)}
				</div>
			</div>
		</details>
	);
}
