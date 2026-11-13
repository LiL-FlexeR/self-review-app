import { z as zod } from 'zod';

export const LinearCredentials = zod.strictObject({
	token: zod
		.string()
		.trim()
		.min(1)
		.max(4096)
		.regex(/^[\x21-\x7e]+$/),
});
export const LinearConnectionCommand = zod.strictObject({
	provider: zod.literal('linear'),
	displayName: zod.string().trim().min(1).max(100),
	credentials: LinearCredentials,
});
export const JiraCredentials = zod.strictObject({
	email: zod.email().max(320),
	token: LinearCredentials.shape.token,
	cloudId: zod.uuid(),
});
export const TrackerCredentials = zod.union([LinearCredentials, JiraCredentials]);
export const LiveConnectionCommand = zod.discriminatedUnion('provider', [
	LinearConnectionCommand,
	zod.strictObject({
		provider: zod.literal('clickup'),
		displayName: LinearConnectionCommand.shape.displayName,
		credentials: LinearCredentials,
	}),
	zod.strictObject({
		provider: zod.literal('jira'),
		displayName: LinearConnectionCommand.shape.displayName,
		credentials: JiraCredentials,
	}),
]);
export const ReplaceCredentialsCommand = zod.strictObject({ credentials: TrackerCredentials });
export const DeleteConnectionCommand = zod.strictObject({ confirm: zod.literal(true) });
export type TLinearConnectionCommand = zod.infer<typeof LinearConnectionCommand>;
export type TLiveConnectionCommand = zod.infer<typeof LiveConnectionCommand>;
export type TTrackerCredentials = zod.infer<typeof TrackerCredentials>;
