import type { ReactNode } from 'react';
import { Status } from '@app/components/ui/Status';
import { Skeleton } from '@app/components/ui/Skeleton';

export function LoadingState({
	children,
	reserveSpace = false,
}: {
	children: ReactNode;
	reserveSpace?: boolean;
}) {
	return (
		<div className="space-y-4">
			<Status variant="loading">{children}</Status>
			{reserveSpace && (
				<div aria-hidden="true" className="space-y-4 py-4">
					<Skeleton className="h-5 w-2/3 max-w-80" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-5/6" />
				</div>
			)}
		</div>
	);
}
