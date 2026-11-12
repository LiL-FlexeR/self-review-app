import { HTTP_ERROR_CODE, HTTP_ERROR_MESSAGE } from '@self-review/contracts';
import { Inject, Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { ConfigService } from '@app/shared/config/config.service';
import { ClockService } from '@app/shared/clock/clock.service';
import type { TAccess } from '@app/modules/auth/auth.types';
import { AppLogger } from '@app/shared/logging/logger';

const logger = new AppLogger('CryptoService');

@Injectable()
export class CryptoService {
	constructor(
		@Inject(ConfigService) private readonly configuration: ConfigService,
		@Inject(ClockService) private readonly clock: ClockService,
	) {}

	generateRandomToken(): string {
		return randomBytes(32).toString('base64url');
	}

	hashSha256(value: string): string {
		return createHash('sha256').update(value).digest('hex');
	}

	createHmac(purpose: string, ...parts: string[]): string {
		return createHmac('sha256', this.configuration.get('AUTH_SECRET'))
			.update(JSON.stringify([purpose, ...parts]))
			.digest('base64url');
	}

	areEqual(left: string, right: string): boolean {
		const leftBuffer = Buffer.from(left);
		const rightBuffer = Buffer.from(right);

		return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
	}

	createCsrfToken(sessionId: string): string {
		const nonce = this.generateRandomToken();

		return nonce + '.' + this.createHmac('csrf', sessionId, nonce);
	}

	verifyCsrfToken(sessionId: string, token: unknown): void {
		if (typeof token !== 'string' || token.length > 200) {
			throw new ForbiddenException({
				code: HTTP_ERROR_CODE.CSRF_INVALID,
				message: HTTP_ERROR_MESSAGE.CSRF_INVALID,
				retryable: false,
			});
		}

		const [nonce, signature, ...remainingParts] = token.split('.');

		if (
			!nonce ||
			!signature ||
			remainingParts.length ||
			!this.areEqual(signature, this.createHmac('csrf', sessionId, nonce))
		) {
			throw new ForbiddenException({
				code: HTTP_ERROR_CODE.CSRF_INVALID,
				message: HTTP_ERROR_MESSAGE.CSRF_INVALID,
				retryable: false,
			});
		}
	}

	async signAccessToken(userId: string, sessionId: string, deadline: Date) {
		const now = this.clock.now();
		const expiresAt = Math.min(
			Math.floor(now.getTime() / 1000) + 900,
			Math.floor(deadline.getTime() / 1000),
		);
		const token = await new SignJWT({ sid: sessionId, amr: ['pwd', 'otp'] })
			.setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
			.setSubject(userId)
			.setIssuer('self-review-app')
			.setAudience('self-review-api')
			.setIssuedAt(Math.floor(now.getTime() / 1000))
			.setExpirationTime(expiresAt)
			.sign(new TextEncoder().encode(this.configuration.get('JWT_SECRET')));

		return { token, expiresAt: new Date(expiresAt * 1000) };
	}

	async verifyAccessToken(token: string | undefined): Promise<TAccess> {
		if (!token) {
			throw new UnauthorizedException({
				code: HTTP_ERROR_CODE.ACCESS_MISSING,
				message: HTTP_ERROR_MESSAGE.ACCESS_MISSING,
				retryable: false,
			});
		}

		try {
			const { payload } = await jwtVerify(
				token,
				new TextEncoder().encode(this.configuration.get('JWT_SECRET')),
				{
					algorithms: ['HS256'],
					issuer: 'self-review-app',
					audience: 'self-review-api',
					currentDate: this.clock.now(),
					requiredClaims: ['sub', 'sid', 'exp', 'iat', 'amr'],
				},
			);
			const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;

			if (
				typeof payload.sub !== 'string' ||
				!uuid.test(payload.sub) ||
				typeof payload.sid !== 'string' ||
				!uuid.test(payload.sid) ||
				!Array.isArray(payload.amr) ||
				payload.amr.length !== 2 ||
				payload.amr[0] !== 'pwd' ||
				payload.amr[1] !== 'otp' ||
				typeof payload.exp !== 'number'
			) {
				logger.error('operation_rejected', { reason: 'ACCESS_CLAIMS_INVALID' });
				throw Error();
			}

			return { sub: payload.sub, sid: payload.sid, exp: payload.exp };
		} catch (error) {
			logger.error('access_token_verification_failed', { error });
			const code =
				(error as { code?: string }).code === 'ERR_JWT_EXPIRED'
					? HTTP_ERROR_CODE.ACCESS_EXPIRED
					: HTTP_ERROR_CODE.ACCESS_INVALID;

			throw new UnauthorizedException({
				code,
				message: HTTP_ERROR_MESSAGE[code],
				retryable: false,
			});
		}
	}
}
