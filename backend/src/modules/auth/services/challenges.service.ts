import { HTTP_ERROR_CODE, HTTP_ERROR_MESSAGE } from '@self-review/contracts';
import type { THttpErrorCode } from '@self-review/contracts';
import { randomInt, randomUUID } from 'node:crypto';
import {
	Inject,
	Injectable,
	HttpException,
	HttpStatus,
	UnauthorizedException,
	BadGatewayException,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { TConfig } from '@app/shared/config/config.schema';
import { ConfigService } from '@app/shared/config/config.service';
import { RedisService } from '@app/shared/redis/redis.service';
import { MailService } from '@app/shared/mail/mail.service';
import type { IMail } from '@app/shared/mail/mail';
import { CryptoService } from './crypto.service.js';
import type { TPending } from '@app/modules/auth/auth.types';
import { AppLogger } from '@app/shared/logging/logger';

const logger = new AppLogger('ChallengesService');

type TStored = TPending & {
	binding: string;
	codeHash: string;
	attempts: number;
	expiresAt: string;
	resendAt: string;
	status: string;
};

const limitScript = `
for keyIndex=1,#KEYS do
 local count=tonumber(redis.call('GET',KEYS[keyIndex]) or '0')
 if count>=tonumber(ARGV[keyIndex]) then return 0 end
end
for keyIndex=1,#KEYS do
 local count=redis.call('INCR',KEYS[keyIndex])
 if count==1 then redis.call('EXPIRE',KEYS[keyIndex],tonumber(ARGV[#KEYS+keyIndex])) end
end
return 1`;

const verifyScript = `
local raw=redis.call('GET',KEYS[1]); if not raw then return {'expired'} end
local challenge=cjson.decode(raw)
if challenge.binding~=ARGV[1] then return {'invalid'} end
if challenge.status~='ready' then return {'sending'} end
if challenge.attempts>=5 then return {'attempts'} end
if challenge.codeHash~=ARGV[2] then
 challenge.attempts=challenge.attempts+1
 redis.call('SET',KEYS[1],cjson.encode(challenge),'KEEPTTL')
 return {challenge.attempts>=5 and 'attempts' or 'invalid'}
end
redis.call('DEL',KEYS[1]); return {'ok',raw}`;

const OTP_FAILURE_CODE: Readonly<Record<string, THttpErrorCode>> = {
	invalid: HTTP_ERROR_CODE.OTP_INVALID,
	expired: HTTP_ERROR_CODE.OTP_EXPIRED,
	attempts: HTTP_ERROR_CODE.OTP_ATTEMPTS,
	sending: HTTP_ERROR_CODE.OTP_SENDING,
};

@Injectable()
export class ChallengesService {
	readonly redis: Redis;
	readonly configuration: Readonly<TConfig>;

	constructor(
		@Inject(RedisService) connection: RedisService,
		@Inject(ConfigService) configuration: ConfigService,
		@Inject(MailService) readonly mail: IMail,
		@Inject(CryptoService) private readonly cryptoService: CryptoService,
	) {
		this.redis = connection.client;
		this.configuration = configuration.values;
	}

	key(id: string) {
		return this.configuration.REDIS_PREFIX + 'otp:' + id;
	}

	async reserve(keys: string[], limits: number[], ttls: number[]) {
		const ok = await this.redis.eval(
			limitScript,
			keys.length,
			...keys.map((key) => this.configuration.REDIS_PREFIX + key),
			...limits,
			...ttls,
		);

		if (ok !== 1) {
			throw new HttpException(
				{
					code: HTTP_ERROR_CODE.RATE_LIMITED,
					message: HTTP_ERROR_MESSAGE.RATE_LIMITED,
					retryable: false,
				},
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}
	}

	async passwordAttempt(email: string, ip: string) {
		const keys = [
			'pwd:email:' + this.cryptoService.hashSha256(email),
			'pwd:ip:' + this.cryptoService.hashSha256(ip),
		];

		await this.reserve(keys, [10, 10], [900, 900]);

		return async () => {
			await this.redis.eval(
				`for keyIndex=1,#KEYS do if tonumber(redis.call('GET',KEYS[keyIndex]) or '0')>0 then redis.call('DECR',KEYS[keyIndex]) end end return 1`,
				2,
				...keys.map((key) => this.configuration.REDIS_PREFIX + key),
			);
		};
	}

	async sends(email: string, ip: string) {
		await this.reserve(
			[
				'send:cool:' + this.cryptoService.hashSha256(email),
				'send:email:' + this.cryptoService.hashSha256(email),
				'send:ip:' + this.cryptoService.hashSha256(ip),
			],
			[1, 5, 20],
			[60, 900, 900],
		);
	}

	public(id: string, challenge: TStored) {
		const [local, domain] = challenge.email.split('@');

		return {
			challengeId: id,
			maskedEmail: local!.slice(0, 1) + '***@' + domain,
			expiresAt: challenge.expiresAt,
			resendAt: challenge.resendAt,
			mailDelivery: this.configuration.MAIL_DELIVERY,
		};
	}

	async create(pendingChallenge: TPending, ip: string) {
		await this.sends(pendingChallenge.email, ip);

		const id = randomUUID();
		const binding = this.cryptoService.generateRandomToken();
		const challenge = await this.deliver(
			id,
			{ ...pendingChallenge, binding: this.cryptoService.hashSha256(binding), attempts: 0 },
			false,
		);

		return { challenge: this.public(id, challenge), binding };
	}

	async deliver(
		id: string,
		pendingChallenge: TPending & { binding: string; attempts: number },
		existing: boolean,
	) {
		let code: string;

		do {
			code = randomInt(0, 1000000).toString().padStart(6, '0');
		} while (
			existing &&
			'codeHash' in pendingChallenge &&
			this.cryptoService.createHmac('otp', id, code) === pendingChallenge.codeHash
		);

		const challenge: TStored = {
			...pendingChallenge,
			codeHash: this.cryptoService.createHmac('otp', id, code),
			expiresAt: new Date(Date.now() + 600000).toISOString(),
			resendAt: new Date(Date.now() + 60000).toISOString(),
			status: 'sending',
		};

		if (existing) {
			const result = await this.redis.eval(
				`local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end local challenge=cjson.decode(raw); if challenge.binding~=ARGV[1] or challenge.status~='ready' or challenge.attempts>=5 then return 0 end local next=cjson.decode(ARGV[2]); next.attempts=challenge.attempts; redis.call('SET',KEYS[1],cjson.encode(next),'EX',600); return 1`,
				1,
				this.key(id),
				pendingChallenge.binding,
				JSON.stringify(challenge),
			);

			if (result !== 1) {
				throw new UnauthorizedException({
					code: HTTP_ERROR_CODE.OTP_EXPIRED,
					message: HTTP_ERROR_MESSAGE.OTP_EXPIRED,
					retryable: false,
				});
			}
		} else {
			await this.redis.set(this.key(id), JSON.stringify(challenge), 'EX', 600);
		}

		try {
			await this.mail.send(challenge.email, code);
		} catch (error) {
			logger.error('otp_delivery_failed', { error });
			await this.redis.del(this.key(id));
			throw new BadGatewayException({
				code: HTTP_ERROR_CODE.MAIL_DELIVERY_FAILED,
				message: HTTP_ERROR_MESSAGE.MAIL_DELIVERY_FAILED,
				retryable: true,
			});
		}
		await this.redis.eval(
			`local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end local challenge=cjson.decode(raw); if challenge.codeHash~=ARGV[1] then return 0 end challenge.status='ready'; redis.call('SET',KEYS[1],cjson.encode(challenge),'KEEPTTL'); return 1`,
			1,
			this.key(id),
			challenge.codeHash,
		);

		return challenge;
	}

	async resend(id: string, binding: string | undefined, ip: string) {
		const raw = await this.redis.get(this.key(id));
		const pendingChallenge = raw ? (JSON.parse(raw) as TStored) : null;

		if (
			!pendingChallenge ||
			!binding ||
			!this.cryptoService.areEqual(
				pendingChallenge.binding,
				this.cryptoService.hashSha256(binding),
			)
		) {
			throw new UnauthorizedException({
				code: HTTP_ERROR_CODE.OTP_EXPIRED,
				message: HTTP_ERROR_MESSAGE.OTP_EXPIRED,
				retryable: false,
			});
		}

		if (pendingChallenge.attempts >= 5) {
			throw new UnauthorizedException({
				code: HTTP_ERROR_CODE.OTP_ATTEMPTS,
				message: HTTP_ERROR_MESSAGE.OTP_ATTEMPTS,
				retryable: false,
			});
		}

		await this.sends(pendingChallenge.email, ip);

		return this.public(id, await this.deliver(id, pendingChallenge, true));
	}

	async consume(id: string, code: string, binding: string | undefined): Promise<TPending> {
		if (!binding) {
			throw new UnauthorizedException({
				code: HTTP_ERROR_CODE.OTP_INVALID,
				message: HTTP_ERROR_MESSAGE.OTP_INVALID,
				retryable: false,
			});
		}

		const result = (await this.redis.eval(
			verifyScript,
			1,
			this.key(id),
			this.cryptoService.hashSha256(binding),
			this.cryptoService.createHmac('otp', id, code),
		)) as string[];

		if (result[0] !== 'ok') {
			const failureCode = OTP_FAILURE_CODE[result[0]!];

			if (!failureCode) {
				logger.error('operation_rejected', { reason: 'OTP_VERIFICATION_UNEXPECTED' });
				throw Error('Unexpected OTP verification result');
			}

			throw new HttpException(
				{
					code: failureCode,
					message:
						result[0] === 'attempts'
							? HTTP_ERROR_MESSAGE.OTP_ATTEMPTS
							: HTTP_ERROR_MESSAGE.OTP_INVALID_OR_EXPIRED,
					retryable: false,
				},
				result[0] === 'sending' ? HttpStatus.CONFLICT : HttpStatus.UNAUTHORIZED,
			);
		}

		return JSON.parse(result[1]!) as TPending;
	}
}
