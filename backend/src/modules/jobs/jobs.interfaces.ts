import type { TAnalysis } from '@app/modules/agent/agent.schemas';
import type { IProviderTask } from '@app/modules/providers/provider.interfaces';
import type { Prisma } from '@app/generated/prisma/client';

export interface IJobScope {
	selection: Prisma.InputJsonValue;
	subjectSourceUserId: string;
	baseSyncRunId?: string;
	sourceSyncRunId?: string;
	importComplete: boolean;
}

export interface IJobRequest extends IJobScope {
	ownerId: string;
	projectId: string;
	type: 'sync' | 'review';
	generateReview: boolean;
	idempotencyKey: string;
	requestFingerprint: string;
}

export interface IImportCoverage {
	discoveryComplete: boolean;
	refreshFailed: boolean;
}

export interface ITaskRefresh {
	refreshStatus: 'fresh' | 'copied' | 'stale';
	details?: IProviderTask;
	refreshFailed: boolean;
	errorCode?: string;
}

export interface ISyncPublication {
	analysis: TAnalysis;
	discoveryComplete: boolean;
	importComplete: boolean;
	saved: number;
	usage: Prisma.InputJsonValue;
}
