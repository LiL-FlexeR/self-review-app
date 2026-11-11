import { Module } from '@nestjs/common';
import { InfrastructureModule } from '@app/shared/infrastructure/infrastructure.module';
import { WorkerReadinessService } from '@app/modules/worker/worker-readiness.service';

// Foundation process only; job processors are introduced in S02.
@Module({
	imports: [InfrastructureModule],
	providers: [WorkerReadinessService],
})
export class WorkerModule {}
