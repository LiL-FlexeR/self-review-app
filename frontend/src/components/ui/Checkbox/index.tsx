import * as React from 'react';
import { cn } from '@app/lib/utils';
import { CheckIcon } from 'lucide-react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
	return (
		<CheckboxPrimitive.Root
			data-slot="checkbox"
			className={cn(
				"peer relative flex size-5 shrink-0 items-center justify-center rounded-[4px] border border-control-border bg-background text-accent-foreground before:absolute before:-inset-3 before:content-[''] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error data-[state=checked]:border-accent data-[state=checked]:bg-accent md:before:-inset-2",
				className,
			)}
			{...props}
		>
			<CheckboxPrimitive.Indicator
				data-slot="checkbox-indicator"
				className="grid place-content-center text-current transition-none"
			>
				<CheckIcon className="size-3.5" aria-hidden="true" />
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);
}

export { Checkbox };
