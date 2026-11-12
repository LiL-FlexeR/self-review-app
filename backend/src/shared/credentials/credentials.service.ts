import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { z as zod } from 'zod';
import { LinearCredentials } from '@self-review/contracts';
import { ConfigService } from '@app/shared/config/config.service';

const Envelope = zod.strictObject({
	version: zod.literal(1),
	nonce: zod.string(),
	tag: zod.string(),
	ciphertext: zod.string(),
});

@Injectable()
export class CredentialsService {
	constructor(@Inject(ConfigService) private readonly configuration: ConfigService) {}

	encrypt(
		ownerId: string,
		connectionId: string,
		credentials: zod.infer<typeof LinearCredentials>,
	): string {
		const nonce = randomBytes(12);
		const cipher = createCipheriv(
			'aes-256-gcm',
			Buffer.from(this.configuration.get('TOKEN_ENCRYPTION_KEY'), 'base64'),
			nonce,
		);
		cipher.setAAD(Buffer.from(JSON.stringify([1, ownerId, connectionId])));
		const ciphertext = Buffer.concat([
			cipher.update(JSON.stringify(LinearCredentials.parse(credentials))),
			cipher.final(),
		]);
		return JSON.stringify({
			version: 1,
			nonce: nonce.toString('base64'),
			tag: cipher.getAuthTag().toString('base64'),
			ciphertext: ciphertext.toString('base64'),
		});
	}

	decrypt(ownerId: string, connectionId: string, value: string) {
		const envelope = Envelope.parse(JSON.parse(value));
		const decipher = createDecipheriv(
			'aes-256-gcm',
			Buffer.from(this.configuration.get('TOKEN_ENCRYPTION_KEY'), 'base64'),
			Buffer.from(envelope.nonce, 'base64'),
		);
		decipher.setAAD(Buffer.from(JSON.stringify([1, ownerId, connectionId])));
		decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
		return LinearCredentials.parse(
			JSON.parse(
				Buffer.concat([
					decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
					decipher.final(),
				]).toString('utf8'),
			),
		);
	}
}
