import { BrowserRouter } from 'react-router';
import { SessionRoutes } from '@app/App/components/SessionRoutes';

export function App() {
	return (
		<BrowserRouter>
			<SessionRoutes />
		</BrowserRouter>
	);
}
