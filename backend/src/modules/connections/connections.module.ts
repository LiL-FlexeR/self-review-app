import { Module } from '@nestjs/common';
import { ConfigModule } from '@app/shared/config/config.module';
import { InfrastructureModule } from '@app/shared/infrastructure/infrastructure.module';
import { ProvidersModule } from '@app/modules/providers/providers.module';
import { ConnectionsService } from '@app/modules/connections/services/connections.service';

@Module({
	imports: [ConfigModule, InfrastructureModule, ProvidersModule],
	providers: [ConnectionsService],
	exports: [ConnectionsService],
})
export class ConnectionsModule {}
