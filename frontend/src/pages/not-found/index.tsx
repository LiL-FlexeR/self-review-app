import { Link } from 'react-router';
import { AuthPanel } from '@app/components/templates/AuthPanel';
import { Button } from '@app/components/ui/Button';

export function NotFoundPage() {
	return (
		<AuthPanel title="Page not found">
			<Button asChild variant="outline">
				<Link to="/">Go home</Link>
			</Button>
		</AuthPanel>
	);
}
