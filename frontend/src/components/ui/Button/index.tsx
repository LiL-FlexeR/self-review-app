import { Slot } from 'radix-ui';
import { cn } from '@app/lib/utils';
import { buttonVariants } from './variants';
import type { TButtonProps } from './types';

function Button({
	className,
	variant = 'default',
	size = 'default',
	asChild = false,
	...props
}: TButtonProps) {
	const Comp = asChild ? Slot.Root : 'button';

	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
