import nodemailer from 'nodemailer';
import type { TConfig } from '@app/shared/config/config.schema';

export interface IMail {
	verify(): Promise<void>;
	send(email: string, code: string): Promise<void>;
	close?(): void;
}

export function mail(configuration: TConfig): IMail {
	const transport = nodemailer.createTransport({
		host: configuration.SMTP_HOST,
		port: configuration.SMTP_PORT,
		secure: configuration.SMTP_SECURE === 'true',
		auth: configuration.SMTP_USER
			? { user: configuration.SMTP_USER, pass: configuration.SMTP_PASSWORD }
			: undefined,
		connectionTimeout: 5000,
		greetingTimeout: 5000,
		socketTimeout: 5000,
		logger: false,
		debug: false,
	});

	return {
		async verify() {
			await transport.verify();
		},

		close() {
			transport.close();
		},

		async send(email, code) {
			const info = await transport.sendMail({
				from: configuration.SMTP_FROM,
				to: email,
				subject: 'Your Self Review verification code',
				text: `Your verification code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`,
			});

			if (!info.accepted?.length) {
				throw Error('SMTP rejected');
			}
		},
	};
}
