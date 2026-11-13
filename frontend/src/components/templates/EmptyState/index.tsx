import type { ReactNode } from 'react';

interface IEmptyStateProps {
	title: string;
	children: ReactNode;
	action?: ReactNode;
}

export function EmptyState({ title, children, action }: IEmptyStateProps) {
	return (
		<div className="space-y-3 border-y py-8">
			<h3 className="text-component font-medium">{title}</h3>
			<div className="max-w-prose text-ui text-muted-foreground">{children}</div>
			{action && <div className="pt-1">{action}</div>}
		</div>
	);
}
