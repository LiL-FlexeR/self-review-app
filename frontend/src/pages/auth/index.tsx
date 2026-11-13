import { useLocation } from 'react-router';
import { LoginForm } from '@app/pages/auth/components/LoginForm';

export function AuthPage() {
	const location = useLocation();

	return <LoginForm key={location.pathname} />;
}
