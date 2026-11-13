import { useRef } from 'react';
import type { IReportCitation, TSavedReview } from '@app/pages/project/report-presentation';
import { focusTaskWorkspace } from '@app/pages/project/task-presentation';
import { TaskEvidenceView } from '@app/pages/project/components/TaskEvidenceView';
import { Sheet, SheetContent } from '@app/components/ui/Sheet';

interface IEvidencePanelProps {
	saved: TSavedReview;
	citation?: IReportCitation;
	open: boolean;
	opener: HTMLButtonElement | null;
	onClose: () => void;
}

export function EvidencePanel({ saved, citation, open, opener, onClose }: IEvidencePanelProps) {
	const heading = useRef<HTMLHeadingElement>(null);
	const source = saved.sources.find((item) => item.id === citation?.sourceId);
	return (
		<Sheet
			open={open}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
		>
			<SheetContent
				className="w-full max-w-[640px] gap-0 sm:max-w-[640px]"
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					heading.current?.focus();
				}}
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					if (opener?.isConnected) {
						opener.focus({ preventScroll: true });
					} else {
						focusTaskWorkspace();
					}
				}}
			>
				<TaskEvidenceView
					source={source}
					quote={citation?.quote}
					headingRef={heading}
					onBack={onClose}
					backLabel="Back to self-review"
					title={citation ? `Evidence ${citation.number}` : 'Saved evidence'}
					snapshotId={saved.sourceSyncRunId}
					referenceSourceId={citation?.sourceId}
				/>
			</SheetContent>
		</Sheet>
	);
}
