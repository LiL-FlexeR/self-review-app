import { useRef } from 'react';
import type { TProjectWorkspace } from '@app/pages/project/use-project-workspace';
import { focusTaskWorkspace } from '@app/pages/project/task-presentation';
import { RefreshTasksDialog } from '@app/pages/project/components/RefreshTasksDialog';
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
} from '@app/components/ui/Sheet';
import { TaskDetails } from '@app/pages/project/components/TaskDetails';

export function WorkspacePanels({ workspace }: { workspace: TProjectWorkspace }) {
	const { detailId, setDetail, userId, project } = workspace;
	const opener = useRef<HTMLElement | null>(null);
	const content = useRef<HTMLDivElement>(null);
	const connection = project.data?.connection;
	const owner = connection
		? { id: connection.sourceUserId, name: connection.sourceUserName }
		: undefined;
	return (
		<>
			<RefreshTasksDialog workspace={workspace} />
			<Sheet
				open={!!detailId}
				onOpenChange={(open) => {
					if (!open) {
						setDetail(undefined);
					}
				}}
			>
				<SheetContent
					ref={content}
					className="w-full max-w-[640px] gap-0 sm:max-w-[640px]"
					onOpenAutoFocus={(event) => {
						opener.current =
							document.activeElement instanceof HTMLElement
								? document.activeElement
								: null;
						event.preventDefault();
						content.current
							?.querySelector<HTMLButtonElement>('[data-slot="sheet-close"]')
							?.focus();
					}}
					onCloseAutoFocus={(event) => {
						if (!opener.current?.isConnected || opener.current === document.body) {
							event.preventDefault();
							focusTaskWorkspace();
						}
					}}
				>
					{(!detailId || !userId) && (
						<SheetHeader>
							<SheetTitle>Saved task details</SheetTitle>
							<SheetDescription>
								Saved evidence from the selected snapshot.
							</SheetDescription>
						</SheetHeader>
					)}
					{detailId && userId && (
						<TaskDetails key={detailId} id={detailId} userId={userId} owner={owner} />
					)}
				</SheetContent>
			</Sheet>
		</>
	);
}
