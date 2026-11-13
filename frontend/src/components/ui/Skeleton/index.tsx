import { cn } from '@app/lib/utils';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="skeleton"
			aria-hidden="true"
			className={cn('rounded-md bg-border', className)}
			{...props}
		/>
	);
}

export { Skeleton };
