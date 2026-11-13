import * as React from 'react';
import { cn } from '@app/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				'h-11 w-full min-w-0 rounded-inputs border border-input bg-background px-3 py-2 text-base text-foreground transition-colors selection:bg-accent selection:text-accent-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-ui file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:h-10 md:text-ui',
				'aria-invalid:border-error aria-invalid:border-dashed',
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
