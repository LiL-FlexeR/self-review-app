import { ProjectsModule } from '@app/modules/projects/projects.module';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from '@app/modules/auth/auth.module';
import { SafeErrorsFilter } from '@app/exceptions/safe-errors.filter';

@Module({
	imports: [AuthModule, ProjectsModule],
	providers: [{ provide: APP_FILTER, useClass: SafeErrorsFilter }],
})
export class AppModule {}
