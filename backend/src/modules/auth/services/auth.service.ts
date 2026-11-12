import { HTTP_ERROR_CODE, HTTP_ERROR_MESSAGE } from '@self-review/contracts';
import {
	Inject,
	Injectable,
	ForbiddenException,
	UnauthorizedException,
	ConflictException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { TConfig } from '@app/shared/config/config.schema';
import { ConfigService } from '@app/shared/config/config.service';
import { DatabaseService } from '@app/shared/database/database.service';
import { ClockService } from '@app/shared/clock/clock.service';
import type { TDatabase } from '@app/shared/database/database';
import { ChallengesService } from './challenges.service.js';
import { CryptoService } from './crypto.service.js';
import { PasswordHashService } from './password-hash.service.js';
import { ACCESS, REFRESH, PREAUTH } from '@app/modules/auth/auth.constants';
import type { TPending } from '@app/modules/auth/auth.types';
import { AppLogger } from '@app/shared/logging/logger';

const logger = new AppLogger('AuthService');

@Injectable()
export class AuthService {
	readonly configuration: Readonly<TConfig>;
	readonly db: TDatabase;

	constructor(
		@Inject(ConfigService) configuration: ConfigService,
		@Inject(DatabaseService) storage: DatabaseService,
		@Inject(ChallengesService) readonly challenges: ChallengesService,
		@Inject(ClockService) private readonly clock: ClockService,
		@Inject(CryptoService) private readonly cryptoService: CryptoService,
		@Inject(PasswordHashService) private readonly passwordHashService: PasswordHashService,
	) {
		this.configuration = configuration.values;
		this.db = storage.client;
	}

	now(): Date {
		return this.clock.now();
	}

	origin(req: Request) {
		if (req.get('origin') !== this.configuration.APP_ORIGIN) {
			throw new ForbiddenException({
				code: HTTP_ERROR_CODE.ORIGIN_INVALID,
				message: HTTP_ERROR_MESSAGE.ORIGIN_INVALID,
				retryable: false,
			});
		}
	}

	async begin(kind: 'signup' | 'login', email: string, password: string, ip: string) {
		const release = await this.challenges.passwordAttempt(email, ip);
		const user = await this.db.user.findUnique({ where: { email } });
		let pending: TPending;

		if (kind === 'login') {
			const valid = await this.passwordHashService.verifyPassword(
				password,
				user?.passwordHash,
			);

			if (!valid || !user) {
				throw new UnauthorizedException({
					code: HTTP_ERROR_CODE.CREDENTIALS_INVALID,
					message: HTTP_ERROR_MESSAGE.CREDENTIALS_INVALID,
					retryable: false,
				});
			}

			pending = { email, userId: user.id };
		} else {
			if (user) {
				throw new ConflictException({
					code: HTTP_ERROR_CODE.SIGNUP_UNAVAILABLE,
					message: HTTP_ERROR_MESSAGE.SIGNUP_UNAVAILABLE,
					retryable: false,
				});
			}

			pending = {
				email,
				passwordHash: await this.passwordHashService.hashPassword(password),
			};
		}

		await release();

		return this.challenges.create(pending, ip);
	}

	private cookie(res: Response, name: string, value: string, path: string, expires: Date) {
		res.cookie(name, value, {
			path,
			expires,
			httpOnly: true,
			sameSite: 'lax',
			secure: this.configuration.APP_ORIGIN.startsWith('https://'),
		});
	}

	preauth(res: Response, binding: string, expiresAt: string) {
		this.cookie(res, PREAUTH, binding, '/api/auth', new Date(expiresAt));
	}

	clear(res: Response) {
		for (const [name, path] of [
			[ACCESS, '/api'],
			[REFRESH, '/api/auth'],
			[PREAUTH, '/api/auth'],
		]) {
			res.clearCookie(name!, {
				path,
				httpOnly: true,
				sameSite: 'lax',
				secure: this.configuration.APP_ORIGIN.startsWith('https://'),
			});
		}
	}

	private async issue(
		res: Response,
		user: { id: string; email: string },
		session: { id: string; expiresAt: Date },
		refresh: string,
	) {
		const access = await this.cryptoService.signAccessToken(
			user.id,
			session.id,
			session.expiresAt,
		);

		this.cookie(res, ACCESS, access.token, '/api', access.expiresAt);
		this.cookie(res, REFRESH, refresh, '/api/auth', session.expiresAt);
		res.clearCookie(PREAUTH, {
			path: '/api/auth',
			httpOnly: true,
			sameSite: 'lax',
			secure: this.configuration.APP_ORIGIN.startsWith('https://'),
		});

		return this.identity(user, session, access.expiresAt);
	}

	private identity(
		user: { id: string; email: string },
		session: { id: string; expiresAt: Date },
		accessExpiresAt: Date,
	) {
		return {
			user: { id: user.id, email: user.email },
			sid: session.id,
			accessExpiresAt: accessExpiresAt.toISOString(),
			sessionExpiresAt: session.expiresAt.toISOString(),
			csrfToken: this.cryptoService.createCsrfToken(session.id),
			mode: this.configuration.APP_MODE,
		};
	}

	async verify(id: string, code: string, binding: string | undefined, res: Response) {
		const pending = await this.challenges.consume(id, code, binding);
		const refresh = this.cryptoService.generateRandomToken();
		const now = this.now();
		const expiresAt = new Date(now.getTime() + 7 * 86400000);
		let result;

		try {
			result = await this.db.$transaction(async (tx) => {
				const user = pending.userId
					? await tx.user.findUniqueOrThrow({ where: { id: pending.userId } })
					: await tx.user.create({
							data: {
								email: pending.email,
								passwordHash: pending.passwordHash!,
								emailVerifiedAt: now,
							},
						});
				const session = await tx.authSession.create({
					data: {
						userId: user.id,
						expiresAt,
						createdAt: now,
						tokens: {
							create: {
								tokenHash: this.cryptoService.hashSha256(refresh),
								expiresAt,
								createdAt: now,
							},
						},
					},
				});

				return { user, session };
			});
		} catch (error) {
			logger.error('signup_persistence_failed', { error });
			if ((error as { code?: string }).code === 'P2002') {
				throw new ConflictException({
					code: HTTP_ERROR_CODE.SIGNUP_UNAVAILABLE,
					message: HTTP_ERROR_MESSAGE.SIGNUP_ALREADY_EXISTS,
					retryable: false,
				});
			}

			throw error;
		}

		return this.issue(res, result.user, result.session, refresh);
	}

	async me(req: Request) {
		const accessClaims = await this.cryptoService.verifyAccessToken(req.cookies?.[ACCESS]);
		const user = await this.db.user.findUnique({ where: { id: accessClaims.sub } });
		const session = await this.db.authSession.findUnique({
			where: { id: accessClaims.sid },
		});

		if (!user || !session || session.userId !== user.id) {
			throw new UnauthorizedException({
				code: HTTP_ERROR_CODE.ACCESS_INVALID,
				message: HTTP_ERROR_MESSAGE.ACCESS_INVALID,
				retryable: false,
			});
		}

		return this.identity(user, session, new Date(accessClaims.exp * 1000));
	}

	async access(req: Request) {
		return this.cryptoService.verifyAccessToken(req.cookies?.[ACCESS]);
	}

	private async token(req: Request) {
		const value = req.cookies?.[REFRESH];

		return typeof value === 'string' && value.length <= 200
			? this.db.refreshToken.findUnique({
					where: { tokenHash: this.cryptoService.hashSha256(value) },
					include: { session: true },
				})
			: null;
	}

	async bootstrap(req: Request) {
		// Prefer refresh identity: refresh/logout must bind CSRF to that exact family.
		const token = await this.token(req);
		const now = this.now();

		if (
			token &&
			!token.consumedAt &&
			!token.session.revokedAt &&
			token.expiresAt > now &&
			token.session.expiresAt > now
		) {
			return {
				csrfToken: this.cryptoService.createCsrfToken(token.sessionId),
				sid: token.sessionId,
				userId: token.session.userId,
			};
		}

		if (req.cookies?.[REFRESH]) {
			throw new UnauthorizedException({
				code: HTTP_ERROR_CODE.REFRESH_INVALID,
				message: HTTP_ERROR_MESSAGE.REFRESH_INVALID,
				retryable: false,
			});
		}

		const accessClaims = await this.access(req);

		return {
			csrfToken: this.cryptoService.createCsrfToken(accessClaims.sid),
			sid: accessClaims.sid,
			userId: accessClaims.sub,
		};
	}

	async refresh(req: Request, res: Response) {
		const token = await this.token(req);

		if (!token) {
			this.clear(res);
			throw new UnauthorizedException({
				code: HTTP_ERROR_CODE.REFRESH_INVALID,
				message: HTTP_ERROR_MESSAGE.REFRESH_INVALID,
				retryable: false,
			});
		}

		this.cryptoService.verifyCsrfToken(token.sessionId, req.get('x-csrf-token'));

		const refresh = this.cryptoService.generateRandomToken();
		const result = await this.db.$transaction(async (tx) => {
			await tx.$queryRaw`SELECT id FROM auth_sessions WHERE id=${token.sessionId}::uuid FOR UPDATE`;

			const now = this.now();
			const current = await tx.refreshToken.findUniqueOrThrow({
				where: { id: token.id },
				include: { session: { include: { user: true } } },
			});

			if (current.consumedAt) {
				await tx.authSession.update({
					where: { id: current.sessionId },
					data: { revokedAt: now },
				});

				return { error: HTTP_ERROR_CODE.REFRESH_REUSED } as const;
			}

			if (current.session.revokedAt) {
				return { error: HTTP_ERROR_CODE.REFRESH_REVOKED } as const;
			}

			if (current.expiresAt <= now || current.session.expiresAt <= now) {
				return { error: HTTP_ERROR_CODE.REFRESH_EXPIRED } as const;
			}

			const consumed = await tx.refreshToken.updateMany({
				where: { id: current.id, consumedAt: null },
				data: { consumedAt: now },
			});

			if (consumed.count !== 1) {
				logger.error('operation_rejected', { reason: 'REFRESH_CONSUMPTION_FAILED' });
				throw Error('Conditional consumption failed');
			}

			const next = await tx.refreshToken.create({
				data: {
					id: randomUUID(),
					tokenHash: this.cryptoService.hashSha256(refresh),
					sessionId: current.sessionId,
					expiresAt: current.session.expiresAt,
					createdAt: now,
				},
			});

			await tx.refreshToken.update({
				where: { id: current.id },
				data: { replacedById: next.id },
			});

			return { session: current.session, user: current.session.user } as const;
		});

		if ('error' in result) {
			this.clear(res);
			throw new UnauthorizedException({
				code: result.error!,
				message: HTTP_ERROR_MESSAGE[result.error!],
				retryable: false,
			});
		}

		return this.issue(res, result.user, result.session, refresh);
	}

	async logout(req: Request, res: Response) {
		const token = await this.token(req);
		let sid = token?.sessionId;

		if (!sid) {
			try {
				sid = (await this.access(req)).sid;
			} catch (error) {
				logger.error('logout_access_unavailable', { error });
				if (!(error instanceof UnauthorizedException)) {
					throw error;
				}
			}
		}

		if (sid) {
			this.cryptoService.verifyCsrfToken(sid, req.get('x-csrf-token'));

			const id = sid;

			await this.db.$transaction(async (tx) => {
				await tx.$queryRaw`SELECT id FROM auth_sessions WHERE id=${id}::uuid FOR UPDATE`;
				await tx.authSession.updateMany({
					where: { id, revokedAt: null },
					data: { revokedAt: this.now() },
				});
			});
		}

		this.clear(res);

		return { ok: true };
	}
}
