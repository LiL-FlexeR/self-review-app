import type { ReactNode } from 'react';
import { ClientError } from '@app/auth/coordinator';
import { Button } from '@app/components/ui/Button';
import { Status } from '@app/components/ui/Status';

interface IErrorStateProps {
	error: Error;
	title?: string;
	children?: ReactNode;
	onRetry?: () => void;
	retryLabel?: string;
	isRetrying?: boolean;
}

export function ErrorState({
	error,
	title = 'Saved data could not be loaded',
	children,
	onRetry,
	retryLabel = 'Retry reading saved data',
	isRetrying = false,
}: IErrorStateProps) {
	const response = error instanceof ClientError ? error : undefined;
	const isInaccessible = response && [401, 403, 404].includes(response.status);
	let heading = title;
	if (response?.status === 401) {
		heading = 'Authentication required';
	} else if (isInaccessible) {
		heading = 'Resource unavailable';
	} else if (response?.status === 0 || (response && response.status >= 500)) {
		heading = 'Connection unavailable';
	}

	return (
		<div className="space-y-3">
			<Status variant="error">
				<p className="font-medium">{heading}</p>
				<p>{error.message}</p>
				{children && <div>{children}</div>}
			</Status>
			{onRetry && !isInaccessible && (
				<Button
					variant="outline"
					disabled={isRetrying}
					aria-busy={isRetrying}
					onClick={onRetry}
				>
					{isRetrying ? 'Reading saved data…' : retryLabel}
				</Button>
			)}
			{response && (
				<details className="text-metadata text-muted-foreground">
					<summary className="w-fit cursor-pointer">Request details</summary>
					<p className="mt-2 font-mono wrap-anywhere">{response.code}</p>
				</details>
			)}
		</div>
	);
}
