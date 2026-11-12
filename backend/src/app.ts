import 'reflect-metadata';
import { HTTP_ERROR_CODE, HTTP_ERROR_MESSAGE } from '@self-review/contracts';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import cookieParser from 'cookie-parser';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ConfigService } from '@app/shared/config/config.service';
import { DatabaseService } from '@app/shared/database/database.service';
import { RedisService } from '@app/shared/redis/redis.service';
import { MailService } from '@app/shared/mail/mail.service';
import { AppModule } from '@app/modules/app.module';

export function configureHttpApplication(
	app: INestApplication,
	staticDir = path.resolve(import.meta.dirname, '../../frontend/dist'),
): void {
	const configuration = app.get(ConfigService).values;
	const db = app.get(DatabaseService).client;
	const redis = app.get(RedisService).client;
	const mail = app.get(MailService);
	const server = app.getHttpAdapter().getInstance() as express.Express;

	server.disable('x-powered-by');
	server.use((req, res, next) => {
		res.setHeader('Cache-Control', 'no-store');
		res.setHeader('X-Content-Type-Options', 'nosniff');
		res.setHeader('Referrer-Policy', 'same-origin');
		res.setHeader(
			'Content-Security-Policy',
			"default-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
		);

		const origin = req.get('origin');

		if (origin && origin !== configuration.APP_ORIGIN) {
			res.status(403).json({
				error: {
					code: HTTP_ERROR_CODE.ORIGIN_INVALID,
					message: HTTP_ERROR_MESSAGE.ORIGIN_INVALID,
					retryable: false,
				},
				requestId: crypto.randomUUID(),
			});

			return;
		}

		next();
	});
	server.use(cookieParser());

	server.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
	server.get('/api/health/ready', async (_req, res) => {
		try {
			await Promise.all([db.$queryRaw`SELECT 1`, redis.ping(), mail.verify()]);
			res.json({ status: 'ready' });
		} catch {
			res.status(503).json({ status: 'unavailable' });
		}
	});

	server.use(express.static(staticDir, { index: false, fallthrough: true }));
	server.use((req, res, next) => {
		const clientRoute =
			req.path === '/' ||
			['/login', '/register', '/otp', '/connections', '/projects'].includes(req.path) ||
			/^\/projects\/[a-zA-Z0-9-]+$/.test(req.path);

		if (
			req.method === 'GET' &&
			clientRoute &&
			req.accepts('html') &&
			existsSync(path.join(staticDir, 'index.html'))
		) {
			res.sendFile(path.join(staticDir, 'index.html'));
		} else {
			next();
		}
	});
}

export async function createApp(): Promise<INestApplication> {
	const app = await NestFactory.create(AppModule, new ExpressAdapter(), {
		logger: false,
		abortOnError: false,
	});

	try {
		configureHttpApplication(app);
		await app.init();
		return app;
	} catch (error) {
		await app.close();
		throw error;
	}
}
