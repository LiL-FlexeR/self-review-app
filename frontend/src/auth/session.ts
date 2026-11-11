import { QueryClient } from '@tanstack/react-query';
import { Coordinator, browserLock } from './coordinator';

export const queryClient = new QueryClient({
	defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const channel =
	typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('self-review-account');

export const auth = new Coordinator(
	(input, init) => fetch(input, init),
	browserLock,
	() => {
		void queryClient.cancelQueries();
		queryClient.clear();
	},
	() => channel?.postMessage({ type: 'account-change' }),
);

channel?.addEventListener('message', () => {
	auth.invalidate();
	window.dispatchEvent(new Event('auth-change'));
});
