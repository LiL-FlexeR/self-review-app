import { describe, expect, it } from 'vitest';
import { ClientError } from '@app/auth/coordinator';
import { canRetainSavedRead } from './api';

describe('saved data after a read failure', () => {
	it.each([401, 403, 404])(
		'hides inaccessible resources even if HTTP %s is retryable',
		(status) => {
			expect(
				canRetainSavedRead(new ClientError(status, 'SYNTHETIC', 'Unavailable', true)),
			).toBe(false);
		},
	);

	it.each([0, 503])('retains validated content during a retryable HTTP %s failure', (status) => {
		expect(canRetainSavedRead(new ClientError(status, 'SYNTHETIC', 'Unavailable', true))).toBe(
			true,
		);
	});

	it('rejects malformed and definitive failures instead of retaining misleading content', () => {
		expect(canRetainSavedRead(new Error('Invalid response schema'))).toBe(false);
		expect(canRetainSavedRead(new ClientError(409, 'SYNTHETIC', 'Conflict'))).toBe(false);
		expect(canRetainSavedRead(null)).toBe(true);
	});
});
