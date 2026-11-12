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
export const ReplaceCredentialsCommand = zod.strictObject({ credentials: LinearCredentials });
export const DeleteConnectionCommand = zod.strictObject({ confirm: zod.literal(true) });
export type TLinearConnectionCommand = zod.infer<typeof LinearConnectionCommand>;
