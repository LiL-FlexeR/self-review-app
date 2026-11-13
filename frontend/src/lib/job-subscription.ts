import { JobView } from '@self-review/contracts';
import type { TJobView } from '@self-review/contracts';
import { ClientError } from '@app/auth/coordinator';

export type TJobConnectionState =
	'checking' | 'connected' | 'reconnecting' | 'exhausted' | 'inaccessible' | 'invalid' | 'idle';

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
	onConnection?: (connection: TJobConnectionState) => void;
}

export class JobSubscription {
	private stopped = false;
	private version = 0;
	private retries = 0;
	private generation = 0;
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
			this.options.onConnection?.('idle');
			this.stop();
		}
	}

	async start() {
		if (this.stopped) {
			return;
		}
		clearTimeout(this.timer);
		this.timer = undefined;
		this.closeStream?.();
		const generation = ++this.generation;
		const isCurrent = () => !this.stopped && generation === this.generation;
		try {
			const state = JobView.parse(await this.options.read());
			if (!isCurrent()) {
				return;
			}
			this.accept(state);
			if (!['queued', 'running'].includes(state.state)) {
				return;
			}
			this.closeStream = this.options.connect({
				open: () => {
					if (isCurrent()) {
						this.retries = 0;
						this.options.onConnection?.('connected');
						this.options.onStatus('Connected; background work continues.');
					}
				},
				message: (data) => {
					if (!isCurrent()) {
						return;
					}
					try {
						this.accept(JobView.parse(JSON.parse(data)));
					} catch {
						this.generation++;
						this.closeStream?.();
						this.options.onConnection?.('invalid');
						this.options.onStatus(
							'Invalid progress response. Reconnect to check saved state.',
						);
					}
				},
				error: () => {
					if (!isCurrent()) {
						return;
					}
					this.generation++;
					this.closeStream?.();
					this.schedule();
				},
			});
		} catch (error) {
			if (!isCurrent()) {
				return;
			}
			if (error instanceof ClientError && [401, 403, 404].includes(error.status)) {
				this.options.onConnection?.('inaccessible');
				this.options.onStatus(error.message);
				this.stop();
				return;
			}
			this.schedule();
		}
	}

	private schedule() {
		if (this.stopped || this.timer) {
			return;
		}
		if (this.retries >= 3) {
			this.options.onConnection?.('exhausted');
			this.options.onStatus('Connection lost. Use Reconnect; background work continues.');
			return;
		}
		this.options.onStatus('Reconnecting; background work continues…');
		this.options.onConnection?.('reconnecting');
		this.timer = setTimeout(
			() => {
				this.timer = undefined;
				void this.start();
			},
			1000 * 2 ** this.retries++,
		);
	}
}
