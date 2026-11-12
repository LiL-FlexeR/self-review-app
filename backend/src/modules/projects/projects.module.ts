import { Module } from '@nestjs/common';
import { AuthModule } from '@app/modules/auth/auth.module';
import { JobsModule } from '@app/modules/jobs/jobs.module';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';
@Module({
	imports: [AuthModule, JobsModule],
	providers: [ProjectsService],
	controllers: [ProjectsController],
})
export class ProjectsModule {}
