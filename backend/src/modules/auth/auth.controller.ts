import { Body, Controller, Get, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Credentials, VerifyOtp, ResendOtp, EmptyBody } from '@self-review/contracts';
import { AuthService } from '@app/modules/auth/services/auth.service';
import { PREAUTH } from './auth.constants.js';
import { parse } from '@app/utils/http';

@Controller('api/auth')
export class AuthController {
	constructor(@Inject(AuthService) private readonly auth: AuthService) {}

	@Post('signup') async signup(
		@Body() body: unknown,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		return this.begin('signup', body, req, res);
	}

	@Post('login') async login(
		@Body() body: unknown,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		return this.begin('login', body, req, res);
	}

	private async begin(kind: 'signup' | 'login', body: unknown, req: Request, res: Response) {
		this.auth.origin(req);

		const credentials = parse(Credentials, body);
		const signInChallenge = await this.auth.begin(
			kind,
			credentials.email,
			credentials.password,
			req.ip ?? 'unknown',
		);

		this.auth.preauth(res, signInChallenge.binding, signInChallenge.challenge.expiresAt);

		return signInChallenge.challenge;
	}

	@Post('verify-otp') async verify(
		@Body() body: unknown,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		this.auth.origin(req);

		const verification = parse(VerifyOtp, body);

		return this.auth.verify(
			verification.challengeId,
			verification.code,
			req.cookies?.[PREAUTH],
			res,
		);
	}

	@Post('resend-otp') async resend(
		@Body() body: unknown,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		this.auth.origin(req);

		const resendRequest = parse(ResendOtp, body);
		const result = await this.auth.challenges.resend(
			resendRequest.challengeId,
			req.cookies?.[PREAUTH],
			req.ip ?? 'unknown',
		);

		this.auth.preauth(res, req.cookies[PREAUTH], result.expiresAt);

		return result;
	}

	@Get('me') me(@Req() req: Request) {
		return this.auth.me(req);
	}

	@Get('csrf') csrf(@Req() req: Request) {
		return this.auth.bootstrap(req);
	}

	@Post('refresh') refresh(
		@Body() body: unknown,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		this.auth.origin(req);
		parse(EmptyBody, body);

		return this.auth.refresh(req, res);
	}

	@Post('logout') logout(
		@Body() body: unknown,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		this.auth.origin(req);
		parse(EmptyBody, body);

		return this.auth.logout(req, res);
	}
}
