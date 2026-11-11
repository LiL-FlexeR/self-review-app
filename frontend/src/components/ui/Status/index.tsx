import type { ReactNode } from 'react';
import { Alert, AlertDescription } from '@app/components/ui/Alert';

export function Status({ children }: { children: ReactNode }) {
	return (
		<Alert role="status" aria-live="polite" className="rounded-xl wrap-anywhere">
			<AlertDescription>{children}</AlertDescription>
		</Alert>
	);
}
