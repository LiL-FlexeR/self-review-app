import { useState, useSyncExternalStore } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { auth } from '@app/auth/session';
import { Button } from '@app/components/ui/Button';
import { Status } from '@app/components/ui/Status';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@app/components/ui/Sidebar';
import { AppSidebar } from '@app/components/templates/AppShell/components/AppSidebar';
import type { IAppShellProps } from './types';

export function AppShell({ title, description, children }: IAppShellProps) {
	const user = useSyncExternalStore(auth.subscribe, auth.snapshot);
	const location = useLocation();
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	const account = useQuery({
		queryKey: ['account', user?.user.id, user?.sid],
		queryFn: ({ signal }) => auth.request('/auth/me', { signal }),
		enabled: !!user,
	});

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
		<SidebarProvider>
			<a
				className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:p-2"
				href="#content"
			>
				Skip to content
			</a>
			<AppSidebar user={user} busy={busy} onLogout={() => void logout()} />
			<SidebarInset id="content" className="min-w-0">
				<div className="mx-auto flex w-full max-w-[964px] flex-col gap-6 px-4 py-6 md:px-8 md:py-12">
					<header className="space-y-4">
						<div className="flex items-center gap-3">
							<SidebarTrigger />
							<span className="text-sm text-muted-foreground">{user.mode} mode</span>
						</div>
						<h1 className="text-[28px] leading-tight">{title}</h1>
						<p className="text-sm text-muted-foreground">{description}</p>
					</header>
					{(error || account.error) && (
						<Status>
							{error || account.error?.message}{' '}
							<Button variant="outline" onClick={() => void account.refetch()}>
								Retry connection
							</Button>
						</Status>
					)}
					{children}
					<p className="text-sm text-muted-foreground">
						Signing out prevents future renewal. Issued access tokens expire within 15
						minutes.
					</p>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
