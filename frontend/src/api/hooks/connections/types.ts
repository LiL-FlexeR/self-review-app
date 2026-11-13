import type { UseMutationOptions } from '@tanstack/react-query';
import type { z as zod } from 'zod';
import type {
	ConnectionView,
	TLiveConnectionCommand,
	TTrackerCredentials,
} from '@self-review/contracts';

export type TConnection = zod.infer<typeof ConnectionView>;

export type TSaveConnectionInput = {
	connectionId?: string;
	provider: TLiveConnectionCommand['provider'];
	displayName: string;
	credentials: TTrackerCredentials;
};

export type TConnectionMutationOptions<TInput> = Pick<
	UseMutationOptions<TConnection, Error, TInput>,
	'onSuccess' | 'onError'
>;
