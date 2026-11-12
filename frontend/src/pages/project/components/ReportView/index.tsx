import { useQuery } from '@tanstack/react-query';
import { ReviewView } from '@self-review/contracts';
import { TraceView } from '@app/pages/project/components/TraceView';
import { read } from '@app/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@app/components/ui/Card';
import { Button } from '@app/components/ui/Button';
import { Status } from '@app/components/ui/Status';

export function ReportView({ id, userId }: { id: string; userId: string }) {
	const report = useQuery({
		queryKey: [userId, 'report', id],
		queryFn: ({ signal }) => read(`/reviews/${id}`, ReviewView, signal),
	});
	if (report.isPending) {
		return <Status>Loading saved report…</Status>;
	}
	if (report.error) {
		return <Status>{report.error.message}</Status>;
	}
	const saved = report.data!;
	const download = (format: 'json' | 'md') => {
		const url = URL.createObjectURL(
			new Blob([format === 'json' ? JSON.stringify(saved, null, 2) : saved.markdown], {
				type: format === 'json' ? 'application/json' : 'text/markdown',
			}),
		);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `self-review-${id}.${format}`;
		anchor.click();
		URL.revokeObjectURL(url);
	};
	return (
		<Card>
			<CardHeader>
				<CardTitle>Self-review draft</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6 break-words">
				<p className="text-sm text-muted-foreground">
					Subject: {saved.subjectSourceUserId} · {saved.state} · snapshot{' '}
					{saved.sourceSyncRunId}
				</p>
				<p className="text-sm">
					Period / selection: {JSON.stringify(saved.selection)} ·{' '}
					{saved.coverage.targetTasks} subject tasks · all review units:{' '}
					{String(saved.coverage.analysisComplete)}
				</p>
				{saved.draft.groups.length === 0 && <p>No supported claims for the token owner.</p>}
				{saved.draft.groups.map((group, index) => (
					<section key={index} className="space-y-3">
						<h3 className="text-lg">{group.title}</h3>
						{group.claims.map((claim, claimIndex) => (
							<div key={claimIndex} className="space-y-2">
								<p className="text-sm text-muted-foreground">
									{claim.kind.replaceAll('_', ' ')}
								</p>
								<p>{claim.text}</p>
								{claim.evidence.map((pair, pairIndex) => {
									const source = saved.sources.find(
										(item) => item.id === pair.sourceId,
									);
									return (
										<details key={pairIndex} className="rounded-xl border p-3">
											<summary className="cursor-pointer">
												Saved source quotation
											</summary>
											<blockquote className="my-2 border-l pl-3">
												{pair.quote}
											</blockquote>
											<p className="text-xs">{pair.sourceId}</p>
											<p className="text-sm">
												Retrieved: {source?.retrievedAt}
											</p>
											{source?.url && (
												<a
													href={source.url}
													target="_blank"
													rel="noreferrer"
													className="text-sm underline"
												>
													Open tracker source
												</a>
											)}
										</details>
									);
								})}
							</div>
						))}
					</section>
				))}
				<section>
					<h3 className="mb-2">Limitations</h3>
					<ul className="list-disc space-y-2 pl-5">
						{saved.draft.limitations.map((item, index) => (
							<li key={index}>{item}</li>
						))}
					</ul>
				</section>
				<p>{saved.draft.explanation}</p>
				<TraceView runId={saved.reviewRunId} userId={userId} />
				<details>
					<summary>Model usage (scripted/unknown is not an actual zero cost)</summary>
					<pre className="overflow-auto text-xs">
						{JSON.stringify(saved.usage, null, 2)}
					</pre>
				</details>
				<div className="flex flex-wrap gap-2">
					<Button variant="outline" onClick={() => download('md')}>
						Download Markdown
					</Button>
					<Button variant="outline" onClick={() => download('json')}>
						Download JSON
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
