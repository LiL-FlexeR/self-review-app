import { Module } from '@nestjs/common';
import { ConfigModule } from '@app/shared/config/config.module';
import { InfrastructureModule } from '@app/shared/infrastructure/infrastructure.module';
import { AuthController } from './auth.controller.js';
import { AuthService } from '@app/modules/auth/services/auth.service';
import { ChallengesService } from '@app/modules/auth/services/challenges.service';
import { CryptoService } from '@app/modules/auth/services/crypto.service';
import { PasswordHashService } from '@app/modules/auth/services/password-hash.service';

@Module({
	imports: [ConfigModule, InfrastructureModule],
	controllers: [AuthController],
	providers: [AuthService, ChallengesService, CryptoService, PasswordHashService],
	exports: [AuthService, CryptoService],
})
export class AuthModule {}
