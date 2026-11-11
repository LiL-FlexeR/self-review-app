import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from '@app/App';
import { queryClient } from '@app/auth/session';
import '@app/styles/globals.css';

createRoot(document.getElementById('root')!).render(
	<QueryClientProvider client={queryClient}>
		<App />
	</QueryClientProvider>,
);
