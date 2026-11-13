import { ExternalLink } from 'lucide-react';
import type { TTaskListItem, ITaskOwner } from '@app/pages/project/task-presentation';
import {
	TASK_TABLE_ID,
	formatTaskDate,
	detailAvailability,
	commentAvailability,
} from '@app/pages/project/task-presentation';
import {
	Table,
	TableHeader,
	TableBody,
	TableRow,
	TableHead,
	TableCell,
	TableCaption,
} from '@app/components/ui/Table';
import { Checkbox } from '@app/components/ui/Checkbox';
import { Button } from '@app/components/ui/Button';
import { TaskFreshness } from '@app/pages/project/components/TaskFreshness';
import { TaskAssignees } from '@app/pages/project/components/TaskAssignees';

interface ITaskTableProps {
	tasks: TTaskListItem[];
	selected: string[];
	owner?: ITaskOwner;
	onSelect: (taskId: string, checked: boolean) => void;
	onOpen: (taskId: string) => void;
}

export function TaskTable({ tasks, selected, owner, onSelect, onOpen }: ITaskTableProps) {
	return (
		<div
			id={TASK_TABLE_ID}
			className="relative max-w-full overflow-x-auto rounded-md border-y"
			tabIndex={0}
			role="region"
			aria-label="Tasks in this snapshot"
			aria-describedby="task-table-help"
		>
			<Table className="min-w-[1080px] table-fixed">
				<TableCaption className="sr-only">
					Saved tasks on the current page. Selection is retained across pages in this
					snapshot.
				</TableCaption>
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						<TableHead className="w-14">
							<span className="sr-only">Select task</span>
						</TableHead>
						<TableHead className="w-[300px]">Task</TableHead>
						<TableHead className="w-[130px]">Source status</TableHead>
						<TableHead className="w-[170px]">Assignees</TableHead>
						<TableHead className="w-[140px]">Created (UTC)</TableHead>
						<TableHead className="w-[230px]">Saved evidence</TableHead>
						<TableHead className="w-14">
							<span className="sr-only">Source link</span>
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{tasks.map((task) => (
						<TableRow
							key={task.id}
							data-state={selected.includes(task.id) ? 'selected' : undefined}
							className="group"
						>
							<TableCell className="border-l-2 border-transparent group-data-[state=selected]:border-accent">
								<Checkbox
									className="mt-1"
									aria-label={`Select ${task.identifier}`}
									checked={selected.includes(task.id)}
									onCheckedChange={(checked) =>
										onSelect(task.id, checked === true)
									}
								/>
							</TableCell>
							<TableCell>
								<button
									type="button"
									className="block w-full space-y-1 rounded-button-quiet text-left hover:underline"
									aria-label={`Open ${task.identifier}: ${task.title}`}
									onClick={() => onOpen(task.id)}
								>
									<span className="block font-mono text-identifier text-muted-foreground">
										{task.identifier}
									</span>
									<span className="block font-medium wrap-anywhere">
										{task.title}
									</span>
								</button>
							</TableCell>
							<TableCell>
								<span className="inline-block max-w-full rounded-chips border px-2 py-0.5 text-metadata wrap-anywhere">
									{task.state || 'Unavailable'}
								</span>
							</TableCell>
							<TableCell>
								<TaskAssignees ids={task.assignees} owner={owner} />
							</TableCell>
							<TableCell>
								<time
									dateTime={task.sourceCreatedAt}
									title={formatTaskDate(task.sourceCreatedAt, true)}
									className="text-metadata"
								>
									{formatTaskDate(task.sourceCreatedAt)}
								</time>
							</TableCell>
							<TableCell>
								<div className="space-y-2">
									<div className="flex flex-wrap items-center gap-2">
										<TaskFreshness status={task.refreshStatus} />
										<time
											dateTime={task.retrievedAt}
											title={`Retrieved ${formatTaskDate(task.retrievedAt, true)}`}
											aria-label={`Retrieved ${formatTaskDate(task.retrievedAt, true)}`}
											className="text-metadata text-muted-foreground"
										>
											{formatTaskDate(task.retrievedAt)}
										</time>
									</div>
									<div className="space-y-1 text-metadata text-muted-foreground">
										<p>{detailAvailability(task.detailStatus)}</p>
										<p>{commentAvailability(task)}</p>
									</div>
								</div>
							</TableCell>
							<TableCell>
								{task.safeUrl ? (
									<Button variant="ghost" size="icon-sm" asChild>
										<a
											href={task.safeUrl}
											target="_blank"
											rel="noreferrer"
											aria-label={`Open ${task.identifier} in tracker`}
											title={`Open ${task.identifier} in tracker`}
										>
											<ExternalLink aria-hidden="true" />
										</a>
									</Button>
								) : (
									<span
										className="text-metadata text-muted-foreground"
										title="No verified source URL saved"
									>
										—<span className="sr-only">No source link available</span>
									</span>
								)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
