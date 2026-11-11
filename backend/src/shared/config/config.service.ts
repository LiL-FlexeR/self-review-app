import { Injectable } from '@nestjs/common';
import { config } from './config.schema.js';
import type { TConfig } from './config.schema.js';

@Injectable()
export class ConfigService {
	readonly values: Readonly<TConfig> = Object.freeze(config());

	get<TKey extends keyof TConfig>(key: TKey): TConfig[TKey] {
		return this.values[key];
	}
}
