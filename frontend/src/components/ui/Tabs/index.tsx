import type { ComponentProps } from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from '@app/lib/utils';

export function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
	return (
		<TabsPrimitive.Root
			data-slot="tabs"
			className={cn('flex min-w-0 flex-col gap-6', className)}
			{...props}
		/>
	);
}

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			className={cn('flex max-w-full items-center gap-1 border-b', className)}
			{...props}
		/>
	);
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
	return (
		<TabsPrimitive.Trigger
			data-slot="tabs-trigger"
			className={cn(
				'relative min-h-11 shrink-0 border-b-2 border-transparent px-2 py-3 text-sm text-muted-foreground hover:text-foreground data-[state=active]:border-ring data-[state=active]:font-medium data-[state=active]:text-foreground disabled:pointer-events-none disabled:opacity-50 sm:px-4',
				className,
			)}
			{...props}
		/>
	);
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
	return (
		<TabsPrimitive.Content
			data-slot="tabs-content"
			className={cn('min-w-0 flex-1', className)}
			{...props}
		/>
	);
}
