import { useQuery } from '@tanstack/react-query';
import { TaskDetail } from '@self-review/contracts';
import { read } from '@app/lib/api';
import { Status } from '@app/components/ui/Status';
export function TaskDetails({ id, userId }: { id: string; userId: string }) {
	const task = useQuery({
		queryKey: [userId, 'task', id],
		queryFn: ({ signal }) => read(`/tasks/${id}`, TaskDetail, signal),
	});
	if (task.isPending) {
		return <Status>Loading saved task…</Status>;
	}
	if (task.error) {
		return <Status>{task.error.message}</Status>;
	}
	return (
		<div className="space-y-3 whitespace-pre-wrap break-words p-4">
			<h3>{task.data!.title}</h3>
			<p>{task.data!.description || 'No description available.'}</p>
			<p className="text-sm text-muted-foreground">
				Details: {task.data!.detailStatus} · Comments: {task.data!.commentReadState}
				{task.data!.commentsTruncated ? ' (limited excerpt)' : ''} ·{' '}
				{task.data!.refreshStatus} · retrieved {task.data!.retrievedAt}
			</p>
			{task.data!.comments.map((comment) => (
				<blockquote key={comment.id} className="border-l pl-4">
					{comment.body}
				</blockquote>
			))}
			{task.data!.findings.map((claim, index) => (
				<p key={index}>
					{claim.kind}: {claim.text}
				</p>
			))}
		</div>
	);
}
