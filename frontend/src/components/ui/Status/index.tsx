import type { ReactNode } from 'react';
import { CircleCheck, CircleX, Info, LoaderCircle, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@app/components/ui/Alert';

type TStatusProps = {
	children: ReactNode;
	variant?: 'info' | 'loading' | 'success' | 'warning' | 'error';
};

const STATUS_PRESENTATION = {
	info: { icon: Info, label: 'Information', alertVariant: 'default' },
	loading: { icon: LoaderCircle, label: 'Loading', alertVariant: 'default' },
	success: { icon: CircleCheck, label: 'Success', alertVariant: 'success' },
	warning: { icon: TriangleAlert, label: 'Warning', alertVariant: 'warning' },
	error: { icon: CircleX, label: 'Error', alertVariant: 'destructive' },
} as const;

export function Status({ children, variant = 'info' }: TStatusProps) {
	const presentation = STATUS_PRESENTATION[variant];
	const Icon = presentation.icon;
	const isError = variant === 'error';

	return (
		<Alert
			variant={presentation.alertVariant}
			role={isError ? 'alert' : 'status'}
			aria-live={isError ? 'assertive' : 'polite'}
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
