import { useState, useSyncExternalStore } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAccount } from '@app/api/hooks/auth/use-account';
import { auth } from '@app/auth/session';
import { Button } from '@app/components/ui/Button';
import { Status } from '@app/components/ui/Status';
import { AppShellLayout } from '@app/components/templates/AppShell/components/AppShellLayout';
import type { IAppShellProps } from './types';

export function AppShell({
	title,
	description,
	actions,
	contentWidth = 'workspace',
	children,
}: IAppShellProps) {
	const user = useSyncExternalStore(auth.subscribe, auth.snapshot);
	const location = useLocation();
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	const account = useAccount(user);

	if (!user) {
		return <Navigate to="/login" state={{ returnTo: location.pathname }} replace />;
	}

	async function logout() {
		setBusy(true);
		setError('');

		try {
			await auth.logout();
		} catch (error) {
			setError((error as Error).message);
		} finally {
			setBusy(false);
		}
	}

	return (
		<AppShellLayout
			title={title}
			description={description}
			actions={actions}
			contentWidth={contentWidth}
			user={user}
			busy={busy}
			onLogout={() => void logout()}
			feedback={
				(error || account.error) && (
					<Status variant="error">
						{error || account.error?.message}{' '}
						<Button variant="outline" onClick={() => void account.refetch()}>
							Retry connection
						</Button>
					</Status>
				)
			}
		>
			{children}
		</AppShellLayout>
	);
}
