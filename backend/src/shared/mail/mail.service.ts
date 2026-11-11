import { Inject, Injectable } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@app/shared/config/config.service';
import { mail } from './mail.js';
import type { IMail } from './mail.js';

@Injectable()
export class MailService implements IMail, OnApplicationShutdown {
	private readonly transport: IMail;

	constructor(@Inject(ConfigService) configuration: ConfigService) {
		this.transport = mail(configuration.values);
	}

	send(email: string, code: string): Promise<void> {
		return this.transport.send(email, code);
	}

	onApplicationShutdown() {
		this.transport.close?.();
	}
}
