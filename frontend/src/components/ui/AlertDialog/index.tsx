import * as React from 'react';
import { cn } from '@app/lib/utils';
import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';

import { Button } from '@app/components/ui/Button';

function AlertDialog({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
	return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger({
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
	return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />;
}

function AlertDialogPortal({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
	return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />;
}

function AlertDialogOverlay({
	className,
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
	return (
		<AlertDialogPrimitive.Overlay
			data-slot="alert-dialog-overlay"
			className={cn(
				'fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
				className,
			)}
			{...props}
		/>
	);
}

function AlertDialogContent({
	className,
	onOpenAutoFocus,
	onCloseAutoFocus,
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
	const previousFocus = React.useRef<HTMLElement | null>(null);
	return (
		<AlertDialogPortal>
			<AlertDialogOverlay />
			<AlertDialogPrimitive.Content
				data-slot="alert-dialog-content"
				onOpenAutoFocus={(event) => {
					previousFocus.current =
						document.activeElement instanceof HTMLElement
							? document.activeElement
							: null;
					onOpenAutoFocus?.(event);
				}}
				onCloseAutoFocus={(event) => {
					onCloseAutoFocus?.(event);
					const target = previousFocus.current;
					if (
						!event.defaultPrevented &&
						target?.isConnected &&
						target !== document.body
					) {
						event.preventDefault();
						target.focus({ preventScroll: true });
					}
				}}
				className={cn(
					'fixed top-[50dvh] left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] min-w-0 max-w-[480px] -translate-x-1/2 -translate-y-1/2 gap-6 overflow-y-auto overscroll-contain rounded-dialog border bg-surface p-4 shadow-subtle duration-200 wrap-anywhere md:p-6 [&>*]:min-w-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
					className,
				)}
				{...props}
			/>
		</AlertDialogPortal>
	);
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="alert-dialog-header"
			className={cn('flex flex-col gap-2 text-left', className)}
			{...props}
		/>
	);
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="alert-dialog-footer"
			className={cn('flex flex-col gap-2 sm:flex-row sm:justify-end', className)}
			{...props}
		/>
	);
}

function AlertDialogTitle({
	className,
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
	return (
		<AlertDialogPrimitive.Title
			data-slot="alert-dialog-title"
			className={cn('text-component font-medium', className)}
			{...props}
		/>
	);
}

function AlertDialogDescription({
	className,
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
	return (
		<AlertDialogPrimitive.Description
			data-slot="alert-dialog-description"
			className={cn('text-sm text-muted-foreground', className)}
			{...props}
		/>
	);
}

function AlertDialogAction({
	className,
	variant = 'default',
	size = 'default',
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> &
	Pick<React.ComponentProps<typeof Button>, 'variant' | 'size'>) {
	return (
		<Button variant={variant} size={size} asChild>
			<AlertDialogPrimitive.Action
				data-slot="alert-dialog-action"
				className={cn(className)}
				{...props}
			/>
		</Button>
	);
}

function AlertDialogCancel({
	className,
	variant = 'outline',
	size = 'default',
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel> &
	Pick<React.ComponentProps<typeof Button>, 'variant' | 'size'>) {
	return (
		<Button variant={variant} size={size} asChild>
			<AlertDialogPrimitive.Cancel
				data-slot="alert-dialog-cancel"
				className={cn(className)}
				{...props}
			/>
		</Button>
	);
}

export {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogOverlay,
	AlertDialogPortal,
	AlertDialogTitle,
	AlertDialogTrigger,
};
