import type { ComponentProps } from 'react';
import type { VariantProps } from 'class-variance-authority';
import type { buttonVariants } from './variants';

export type TButtonProps = ComponentProps<'button'> &
	VariantProps<typeof buttonVariants> & { asChild?: boolean };
