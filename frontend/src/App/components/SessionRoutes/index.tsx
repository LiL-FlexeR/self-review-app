import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { auth } from '@app/auth/session';
import { Button } from '@app/components/ui/Button';
import { Status } from '@app/components/ui/Status';
import { AuthPage } from '@app/pages/auth';
import { OtpPage } from '@app/pages/otp';
import { ConnectionsPage } from '@app/pages/connections';
import { ProjectPage } from '@app/pages/project';
import { ProjectsPage } from '@app/pages/projects';
import { AuthPanel } from '@app/components/templates/AuthPanel';
import { NotFoundPage } from '@app/pages/not-found';

export function SessionRoutes() {
	const user = useSyncExternalStore(auth.subscribe, auth.snapshot);

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const load = useCallback(() => {
		setLoading(true);
		setError('');
		void auth
			.initialize()
			.catch((error) => setError((error as Error).message))
			.finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		void auth
			.initialize()
			.catch((error) => setError((error as Error).message))
			.finally(() => setLoading(false));
		window.addEventListener('auth-change', load);

		return () => window.removeEventListener('auth-change', load);
	}, [load]);

	if (loading) {
		return (
			<AuthPanel title="Checking your session">
				<Status variant="loading">Checking your session…</Status>
			</AuthPanel>
		);
	}

	if (error) {
		return (
			<AuthPanel title="Connection unavailable">
				<Status variant="error">{error}</Status>
				<Button onClick={load}>Retry</Button>
			</AuthPanel>
		);
	}

	return (
		<Routes>
			<Route
				path="/login"
				element={user ? <Navigate to="/connections" replace /> : <AuthPage />}
			/>
			<Route
				path="/register"
				element={user ? <Navigate to="/connections" replace /> : <AuthPage />}
			/>
			<Route
				path="/otp"
				element={user ? <Navigate to="/connections" replace /> : <OtpPage />}
			/>
			<Route path="/connections" element={<ConnectionsPage />} />
			<Route path="/projects" element={<ProjectsPage />} />
			<Route path="/projects/:id" element={<ProjectPage />} />
			<Route path="/" element={<Navigate to={user ? '/connections' : '/login'} replace />} />
			<Route path="*" element={<NotFoundPage />} />
		</Routes>
	);
}
