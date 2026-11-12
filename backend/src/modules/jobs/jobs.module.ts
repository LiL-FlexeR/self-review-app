import { Module } from '@nestjs/common';
import { ConfigModule } from '@app/shared/config/config.module';
import { InfrastructureModule } from '@app/shared/infrastructure/infrastructure.module';
import { QueueService } from '@app/modules/jobs/services/queue.service';
import { JobsService } from '@app/modules/jobs/services/jobs.service';
import { ReviewService } from '@app/modules/jobs/services/review.service';
import { AgentService } from '@app/modules/agent/services/agent.service';
import { SourcesService } from '@app/modules/agent/services/sources.service';
import { ModelClient } from '@app/modules/agent/services/model-client.service';
import { ProvidersModule } from '@app/modules/providers/providers.module';
@Module({
	imports: [ConfigModule, InfrastructureModule, ProvidersModule],
	providers: [
		QueueService,
		JobsService,
		ReviewService,
		AgentService,
		SourcesService,
		ModelClient,
	],
	exports: [
		QueueService,
		JobsService,
		ReviewService,
		AgentService,
		SourcesService,
		ModelClient,
		ProvidersModule,
		ConfigModule,
		InfrastructureModule,
	],
})
export class JobsModule {}
