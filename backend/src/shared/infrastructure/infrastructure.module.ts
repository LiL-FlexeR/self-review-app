import { Module } from '@nestjs/common';
import { ConfigModule } from '@app/shared/config/config.module';
import { DatabaseService } from '@app/shared/database/database.service';
import { RedisService } from '@app/shared/redis/redis.service';
import { MailService } from '@app/shared/mail/mail.service';
import { ClockService } from '@app/shared/clock/clock.service';

@Module({
	imports: [ConfigModule],
	providers: [DatabaseService, RedisService, MailService, ClockService],
	exports: [DatabaseService, RedisService, MailService, ClockService],
})
export class InfrastructureModule {}
