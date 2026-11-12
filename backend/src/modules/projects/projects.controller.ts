import {
	Body,
	Controller,
	Get,
	Put,
	Delete,
	HttpCode,
	Inject,
	Param,
	Post,
	Query,
	Req,
	Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z as zod } from 'zod';
import {
	FixtureCommand,
	LinearConnectionCommand,
	ReplaceCredentialsCommand,
	DeleteConnectionCommand,
	SyncCommand,
	ReviewCommand,
} from '@self-review/contracts';
import { ConnectionsService } from '@app/modules/connections/services/connections.service';
import { AuthService } from '@app/modules/auth/services/auth.service';
import { CryptoService } from '@app/modules/auth/services/crypto.service';
import { JobsService } from '@app/modules/jobs/services/jobs.service';
import { ProjectsService } from './projects.service.js';
import { parse } from '@app/utils/http';
import { AppLogger } from '@app/shared/logging/logger';

const logger = new AppLogger('ProjectsController');

@Controller('api')
export class ProjectsController {
	constructor(
		@Inject(AuthService) private readonly auth: AuthService,
		@Inject(CryptoService) private readonly cryptoService: CryptoService,
		@Inject(JobsService) private readonly jobs: JobsService,
		@Inject(ProjectsService) private readonly projects: ProjectsService,
		@Inject(ConnectionsService) private readonly connectionService: ConnectionsService,
	) {}

	private async identity(req: Request, mutate = false) {
		const identity = await this.auth.access(req);
		if (mutate) {
			this.auth.origin(req);
			this.cryptoService.verifyCsrfToken(identity.sid, req.get('x-csrf-token'));
		}
		return identity;
	}

	@Get('connections') async connections(@Req() req: Request) {
		return this.projects.connections((await this.identity(req)).sub);
	}
	@Post('connections') async add(@Req() req: Request, @Body() body: unknown) {
		const identity = await this.identity(req, true);
		const command = parse(zod.union([FixtureCommand, LinearConnectionCommand]), body);
		return command.provider === 'fixture'
			? this.projects.add(identity.sub)
			: this.projects.connectionView(await this.connectionService.add(identity.sub, command));
	}
	@Put('connections/:id') async replace(
		@Req() req: Request,
		@Param('id') id: string,
		@Body() body: unknown,
	) {
		const identity = await this.identity(req, true);
		return this.projects.connectionView(
			await this.connectionService.replace(
				identity.sub,
				parse(zod.uuid(), id),
				parse(ReplaceCredentialsCommand, body).credentials,
			),
		);
	}
	@Delete('connections/:id') @HttpCode(200) async remove(
		@Req() req: Request,
		@Param('id') id: string,
		@Body() body: unknown,
	) {
		const identity = await this.identity(req, true);
		parse(DeleteConnectionCommand, body);
		await this.connectionService.remove(identity.sub, parse(zod.uuid(), id));
		return { deleted: true };
	}
	@Get('connections/:id/projects') async catalog(
		@Req() req: Request,
		@Param('id') id: string,
		@Query('cursor') cursor: unknown,
	) {
		return this.projects.catalog((await this.identity(req)).sub, parse(zod.uuid(), id), cursor);
	}
	@Get('projects/:id') async project(@Req() req: Request, @Param('id') id: string) {
		return this.projects.project((await this.identity(req)).sub, parse(zod.uuid(), id));
	}
	@Post('projects/:id/syncs') @HttpCode(202) async sync(
		@Req() req: Request,
		@Param('id') id: string,
		@Body() body: unknown,
	) {
		return this.jobs.create(
			(await this.identity(req, true)).sub,
			parse(zod.uuid(), id),
			'sync',
			parse(SyncCommand, body),
		);
	}
	@Post('projects/:id/reviews') @HttpCode(202) async review(
		@Req() req: Request,
		@Param('id') id: string,
		@Body() body: unknown,
	) {
		return this.jobs.create(
			(await this.identity(req, true)).sub,
			parse(zod.uuid(), id),
			'review',
			parse(ReviewCommand, body),
		);
	}
	@Get('projects/:id/syncs') async history(
		@Req() req: Request,
		@Param('id') id: string,
		@Query('cursor') cursor: unknown,
	) {
		return this.projects.history((await this.identity(req)).sub, parse(zod.uuid(), id), cursor);
	}
	@Get('projects/:id/tasks') async tasks(
		@Req() req: Request,
		@Param('id') id: string,
		@Query('syncRunId') syncRunId: unknown,
		@Query('cursor') cursor: unknown,
	) {
		return this.projects.tasks(
			(await this.identity(req)).sub,
			parse(zod.uuid(), id),
			parse(zod.uuid(), syncRunId),
			cursor,
		);
	}
	@Get('tasks/:id') async task(@Req() req: Request, @Param('id') id: string) {
		return this.projects.task((await this.identity(req)).sub, parse(zod.uuid(), id));
	}
	@Get('reviews/:id') async report(@Req() req: Request, @Param('id') id: string) {
		return this.projects.report((await this.identity(req)).sub, parse(zod.uuid(), id));
	}
	@Get('jobs/:id') async job(@Req() req: Request, @Param('id') id: string) {
		return this.jobs.view(
			await this.jobs.owned((await this.identity(req)).sub, parse(zod.uuid(), id)),
		);
	}
	@Get('jobs/:id/batches') async batches(
		@Req() req: Request,
		@Param('id') id: string,
		@Query('cursor') cursor: unknown,
	) {
		return this.projects.units(
			(await this.identity(req)).sub,
			parse(zod.uuid(), id),
			cursor,
			false,
		);
	}
	@Get('jobs/:id/trace') async trace(
		@Req() req: Request,
		@Param('id') id: string,
		@Query('cursor') cursor: unknown,
	) {
		return this.projects.units(
			(await this.identity(req)).sub,
			parse(zod.uuid(), id),
			cursor,
			true,
		);
	}

	@Get('jobs/:id/events') async events(
		@Req() req: Request,
		@Res() res: Response,
		@Param('id') id: string,
	) {
		const identity = await this.identity(req);
		const runId = parse(zod.uuid(), id);
		const initial = await this.jobs.view(await this.jobs.owned(identity.sub, runId));
		res.setHeader('Content-Type', 'text/event-stream');
		res.setHeader('Cache-Control', 'no-cache');
		res.setHeader('X-Accel-Buffering', 'no');
		res.flushHeaders();
		let version = 0;
		let ticks = 0;
		let busy = false;
		const emit = (state: typeof initial) => {
			if (state.version > version) {
				version = state.version;
				res.write(`id: ${runId}/${version}\ndata: ${JSON.stringify(state)}\n\n`);
			}
		};
		emit(initial);
		if (!['queued', 'running'].includes(initial.state)) {
			res.end();
			return;
		}
		const poll = async () => {
			if (busy) {
				return;
			}
			busy = true;
			try {
				const run = await this.jobs.owned(identity.sub, runId);
				const state = await this.jobs.view(run);
				emit(state);
				if (!['queued', 'running'].includes(state.state)) {
					res.end();
				} else if (++ticks % 15 === 0) {
					res.write(': heartbeat\n\n');
				}
			} catch (error) {
				logger.warn('sse_poll_failed', { error, runId });
				res.end();
			} finally {
				busy = false;
			}
		};
		const timer = setInterval(() => {
			void poll();
		}, 1000);
		const expiry = setTimeout(() => res.end(), Math.max(0, identity.exp * 1000 - Date.now()));
		res.on('close', () => {
			clearInterval(timer);
			clearTimeout(expiry);
		});
	}
}
