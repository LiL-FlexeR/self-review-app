import { useEffect, useState } from 'react';
import { auth, queryClient } from '@app/auth/session';
import { JobSubscription } from '@app/lib/job-subscription';

export function useJobStream(
	runId: string | undefined,
	userId: string | undefined,
	projectId: string,
) {
	const [status, setStatus] = useState('');
	const [cycle, setCycle] = useState(0);
	useEffect(() => {
		if (!runId || !userId) {
			return;
		}
		const initialIdentity = auth.snapshot();
		const subscription = new JobSubscription({
			runId,
			read: () => auth.request(`/jobs/${runId}`),
			onStatus: setStatus,
			connect: (callbacks) => {
				const stream = new EventSource(`/api/jobs/${runId}/events`);
				stream.onopen = callbacks.open;
				stream.onmessage = (event) => callbacks.message(event.data);
				stream.onerror = callbacks.error;
				return () => stream.close();
			},
			onState: (state) => {
				queryClient.setQueryData([userId, 'job', runId], state);
				if (!['queued', 'running'].includes(state.state)) {
					void queryClient.invalidateQueries({
						queryKey: [userId, 'project', projectId],
					});
					if (state.type === 'review') {
						// Publication changes the source snapshot's current-report pointer too.
						void queryClient.invalidateQueries({ queryKey: [userId, 'job'] });
					}
				}
			},
		});
		const unsubscribe = auth.subscribe(() => {
			const identity = auth.snapshot();
			if (
				identity?.user.id !== initialIdentity?.user.id ||
				identity?.sid !== initialIdentity?.sid
			) {
				subscription.stop();
			}
		});
		void subscription.start();
		return () => {
			unsubscribe();
			subscription.stop();
		};
	}, [runId, userId, projectId, cycle]);
	return { status, reconnect: () => setCycle((previous) => previous + 1) };
}
