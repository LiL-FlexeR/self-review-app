import type { ITaskOwner } from '@app/pages/project/task-presentation';

export function TaskAssignees({ ids, owner }: { ids: string[]; owner?: ITaskOwner }) {
	if (!ids.length) {
		return <span className="text-muted-foreground">Unassigned</span>;
	}
	const renderAssignee = (id: string) => (
		<span
			key={id}
			className={`block wrap-anywhere ${id === owner?.id ? '' : 'font-mono text-identifier'}`}
		>
			{id === owner?.id ? owner.name : id}
			{id === owner?.id && <span className="sr-only"> (verified review subject)</span>}
		</span>
	);
	return (
		<div className="space-y-1">
			{ids.slice(0, 2).map(renderAssignee)}
			{ids.length > 2 && (
				<details className="text-muted-foreground">
					<summary className="w-fit cursor-pointer">
						{ids.length - 2} more {ids.length === 3 ? 'assignee' : 'assignees'}
					</summary>
					<div className="mt-2 space-y-1 text-foreground">
						{ids.slice(2).map(renderAssignee)}
					</div>
				</details>
			)}
		</div>
	);
}
