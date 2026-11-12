import { Module } from '@nestjs/common';
import { ConfigModule } from '@app/shared/config/config.module';
import { InfrastructureModule } from '@app/shared/infrastructure/infrastructure.module';
import { FixtureService } from '@app/modules/providers/adapters/fixture/fixture.service';
import { ProvidersService } from './providers.service.js';
import { LinearService } from '@app/modules/providers/adapters/linear/services/linear.service';
import { LinearTransport } from '@app/modules/providers/adapters/linear/services/linear-transport.service';

@Module({
	imports: [ConfigModule, InfrastructureModule],
	providers: [FixtureService, ProvidersService, LinearService, LinearTransport],
	exports: [FixtureService, ProvidersService, LinearService, LinearTransport],
})
export class ProvidersModule {}
