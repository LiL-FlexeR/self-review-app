import { JobView } from '@self-review/contracts';
import type { TJobView } from '@self-review/contracts';
import { ClientError } from '@app/auth/coordinator';

interface ISubscriptionOptions {
	runId: string;
	read: () => Promise<unknown>;
	connect: (callbacks: {
		open: () => void;
		message: (data: string) => void;
		error: () => void;
	}) => () => void;
	onState: (state: TJobView) => void;
	onStatus: (status: string) => void;
}

export class JobSubscription {
	private stopped = false;
	private version = 0;
	private retries = 0;
	private closeStream?: () => void;
	private timer?: ReturnType<typeof setTimeout>;
	constructor(private readonly options: ISubscriptionOptions) {}

	stop() {
		this.stopped = true;
		this.closeStream?.();
		clearTimeout(this.timer);
	}

	private accept(state: TJobView) {
		if (state.runId !== this.options.runId) {
			throw new Error('Progress scope mismatch.');
		}
		if (this.stopped || state.version <= this.version) {
			return;
		}
		this.version = state.version;
		this.options.onState(state);
		this.options.onStatus(`${state.state} · ${state.stage}`);
		if (!['queued', 'running'].includes(state.state)) {
			this.closeStream?.();
		}
	}

	async start() {
		if (this.stopped) {
			return;
		}
		try {
			const state = JobView.parse(await this.options.read());
			if (this.stopped) {
				return;
			}
			this.accept(state);
			if (!['queued', 'running'].includes(state.state)) {
				return;
			}
			this.closeStream = this.options.connect({
				open: () => {
					if (!this.stopped) {
						this.retries = 0;
						this.options.onStatus('Connected; background work continues.');
					}
				},
				message: (data) => {
					try {
						this.accept(JobView.parse(JSON.parse(data)));
					} catch {
						this.closeStream?.();
						this.options.onStatus(
							'Invalid progress response. Reconnect to check saved state.',
						);
					}
				},
				error: () => {
					this.closeStream?.();
					this.schedule();
				},
			});
		} catch (error) {
			if (this.stopped) {
				return;
			}
			if (error instanceof ClientError && [401, 403, 404].includes(error.status)) {
				this.options.onStatus(error.message);
				return;
			}
			this.schedule();
		}
	}

	private schedule() {
		if (this.stopped) {
			return;
		}
		if (this.retries >= 3) {
			this.options.onStatus('Connection lost. Use Reconnect; background work continues.');
			return;
		}
		this.options.onStatus('Reconnecting; background work continues…');
		this.timer = setTimeout(
			() => {
				void this.start();
			},
			1000 * 2 ** this.retries++,
		);
	}
}
