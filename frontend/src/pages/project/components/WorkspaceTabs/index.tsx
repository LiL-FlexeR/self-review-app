import type { TProjectWorkspace } from '@app/pages/project/use-project-workspace';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@app/components/ui/Tabs';
import { Overview } from '@app/pages/project/components/Overview';
import { TasksPanel } from '@app/pages/project/components/TasksPanel';
import { ReviewPanel } from '@app/pages/project/components/ReviewPanel';
import { ActivityPanel } from '@app/pages/project/components/ActivityPanel';

export function WorkspaceTabs({ workspace }: { workspace: TProjectWorkspace }) {
	return (
		<Tabs value={workspace.tab} onValueChange={workspace.setTab}>
			<div
				role="region"
				aria-label="Project sections"
				tabIndex={0}
				className="-m-1.5 min-w-0 overflow-x-auto overscroll-x-contain p-1.5"
			>
				<TabsList aria-label="Project workspace" className="w-max min-w-full">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="tasks">Tasks</TabsTrigger>
					<TabsTrigger value="review">Self-review</TabsTrigger>
					<TabsTrigger value="activity">Activity</TabsTrigger>
				</TabsList>
			</div>
			<TabsContent value="overview">
				<Overview workspace={workspace} />
			</TabsContent>
			<TabsContent value="tasks">
				<TasksPanel workspace={workspace} />
			</TabsContent>
			<TabsContent value="review">
				<ReviewPanel workspace={workspace} />
			</TabsContent>
			<TabsContent value="activity">
				<ActivityPanel workspace={workspace} />
			</TabsContent>
		</Tabs>
	);
}
