import { HTTP_ERROR_CODE, HTTP_ERROR_MESSAGE } from '@self-review/contracts';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import argon2 from 'argon2';
import { CryptoService } from './crypto.service.js';

const MAX_CONCURRENT_PASSWORD_OPERATIONS = 4;

@Injectable()
export class PasswordHashService implements OnModuleInit {
	private activeOperations = 0;
	private dummyPasswordHash = '';

	constructor(@Inject(CryptoService) private readonly cryptoService: CryptoService) {}

	async onModuleInit(): Promise<void> {
		this.dummyPasswordHash = await this.hashPassword(this.cryptoService.generateRandomToken());
	}

	hashPassword(password: string): Promise<string> {
		return this.hashOperation(() => argon2.hash(password, { type: argon2.argon2id }));
	}

	verifyPassword(password: string, passwordHash?: string): Promise<boolean> {
		// Missing accounts still perform an Argon2 verification against the dummy hash.
		return this.hashOperation(() =>
			argon2.verify(passwordHash ?? this.dummyPasswordHash, password),
		);
	}

	async verifyDummyPassword(password: string): Promise<void> {
		await this.verifyPassword(password);
	}

	private async hashOperation<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
		if (this.activeOperations >= MAX_CONCURRENT_PASSWORD_OPERATIONS) {
			throw new ServiceUnavailableException({
				code: HTTP_ERROR_CODE.AUTH_BUSY,
				message: HTTP_ERROR_MESSAGE.AUTH_BUSY,
				retryable: true,
			});
		}

		this.activeOperations++;

		try {
			return await operation();
		} finally {
			this.activeOperations--;
		}
	}
}
