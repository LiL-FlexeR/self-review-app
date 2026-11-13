import type { TJobView } from '@self-review/contracts';
import { ClientError } from '@app/auth/coordinator';

export function snapshotForDisplay(snapshot: TJobView | undefined, error: Error | null) {
	const canRetain =
		!error ||
		(error instanceof ClientError &&
			error.retryable &&
			![401, 403, 404].includes(error.status));
	return canRetain && snapshot?.type === 'sync' ? snapshot : undefined;
}
