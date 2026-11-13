import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
	"inline-flex min-w-0 max-w-full shrink-0 items-center justify-center gap-2 text-center text-ui font-medium whitespace-normal wrap-anywhere transition-colors disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-error [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default:
					'rounded-button-filled bg-primary text-primary-foreground hover:bg-primary/90',
				destructive:
					'rounded-button-filled bg-destructive text-destructive-foreground hover:bg-destructive/90',
				outline:
					'rounded-button-quiet border border-control-border bg-background hover:bg-hover hover:text-foreground',
				secondary:
					'rounded-button-quiet bg-secondary text-secondary-foreground hover:bg-hover',
				ghost: 'rounded-button-quiet hover:bg-hover hover:text-foreground',
				link: 'rounded-button-quiet text-primary underline-offset-4 hover:underline',
			},
			size: {
				default: 'min-h-11 px-4 py-2 md:min-h-10 has-[>svg]:px-3',
				xs: "min-h-11 gap-1 px-2 py-1 md:min-h-8 has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: 'min-h-11 gap-1.5 px-3 py-1.5 md:min-h-9 has-[>svg]:px-2.5',
				lg: 'min-h-12 px-6 py-3 has-[>svg]:px-4',
				icon: 'size-11 md:size-10',
				'icon-xs': "size-11 md:size-8 [&_svg:not([class*='size-'])]:size-3",
				'icon-sm': 'size-11 md:size-9',
				'icon-lg': 'size-12',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
);
