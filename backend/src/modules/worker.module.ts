import { JobsModule } from '@app/modules/jobs/jobs.module';
import { ProcessorService } from '@app/modules/jobs/services/processor.service';
import { Module } from '@nestjs/common';
import { InfrastructureModule } from '@app/shared/infrastructure/infrastructure.module';
import { WorkerReadinessService } from '@app/modules/worker/worker-readiness.service';

@Module({
	imports: [InfrastructureModule, JobsModule],
	providers: [WorkerReadinessService, ProcessorService],
})
export class WorkerModule {}
