import type { ReactNode } from 'react';
import { CircleCheck, CircleX, Info, LoaderCircle, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@app/components/ui/Alert';

type TStatusProps = {
	children: ReactNode;
	variant?: 'info' | 'loading' | 'success' | 'warning' | 'error';
	announce?: boolean;
};

const STATUS_PRESENTATION = {
	info: { icon: Info, label: 'Information', alertVariant: 'default' },
	loading: { icon: LoaderCircle, label: 'Loading', alertVariant: 'default' },
	success: { icon: CircleCheck, label: 'Success', alertVariant: 'success' },
	warning: { icon: TriangleAlert, label: 'Warning', alertVariant: 'warning' },
	error: { icon: CircleX, label: 'Error', alertVariant: 'destructive' },
} as const;

export function Status({ children, variant = 'info', announce = true }: TStatusProps) {
	const presentation = STATUS_PRESENTATION[variant];
	const Icon = presentation.icon;
	const isError = variant === 'error';
	const live = isError ? 'assertive' : 'polite';
	const announcement = announce
		? { role: isError ? 'alert' : 'status', 'aria-live': live }
		: { role: 'note', 'aria-live': 'off' as const };
	if (['info', 'loading', 'success'].includes(variant)) {
		return (
			<div
				{...announcement}
				aria-live={announce ? 'polite' : 'off'}
				aria-atomic="true"
				data-status={variant}
				className={`flex items-start gap-3 py-2 text-ui wrap-anywhere ${variant === 'success' ? 'text-success' : 'text-muted-foreground'}`}
			>
				<Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
				<div className="min-w-0 space-y-2">
					<span className="sr-only">{presentation.label}: </span>
					{children}
				</div>
			</div>
		);
	}

	return (
		<Alert
			variant={presentation.alertVariant}
			{...announcement}
			aria-live={announce ? live : 'off'}
			aria-atomic="true"
			data-status={variant}
			className="wrap-anywhere"
		>
			<Icon aria-hidden="true" />
			<AlertDescription>
				<span className="sr-only">{presentation.label}: </span>
				{children}
			</AlertDescription>
		</Alert>
	);
}
