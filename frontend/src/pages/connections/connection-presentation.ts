import type { z as zod } from 'zod';
import type { ConnectionView } from '@self-review/contracts';

export type TConnection = zod.infer<typeof ConnectionView>;
export type TLiveProvider = 'linear' | 'clickup' | 'jira';

export const LIVE_PROVIDERS: TLiveProvider[] = ['linear', 'clickup', 'jira'];

export const PROVIDERS = {
	linear: {
		label: 'Linear',
		tokenLabel: 'Personal API key',
		instructions: 'Use a Read key, restricted to the intended teams where possible.',
		href: 'https://linear.app/docs/security-and-access#personal-api-keys',
	},
	clickup: {
		label: 'ClickUp',
		tokenLabel: 'Personal API token',
		instructions: 'Use a personal token. Lists retain their workspace, Space and Folder path.',
		href: 'https://developer.clickup.com/docs/authentication',
	},
	jira: {
		label: 'Jira Cloud',
		tokenLabel: 'Scoped personal API token',
		instructions:
			'Use a scoped token with permission to read your profile, projects, issues and comments.',
		href: 'https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/',
	},
};

export function isLiveProvider(provider: string): provider is TLiveProvider {
	return LIVE_PROVIDERS.some((candidate) => candidate === provider);
}

export function providerLabel(provider: string) {
	if (isLiveProvider(provider)) {
		return PROVIDERS[provider].label;
	}
	return provider === 'fixture' ? 'Synthetic demo source' : provider;
}

export function connectionMode(connection: TConnection) {
	const data = connection.provider === 'fixture' ? 'Synthetic data' : `${connection.mode} data`;
	const model =
		connection.modelMode === 'scripted' ? 'scripted model' : `${connection.modelMode} model`;
	return `${data} · ${model}`;
}

export function verificationDate(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return 'Verification date unavailable';
	}
	return (
		date.toLocaleString('en', {
			dateStyle: 'medium',
			timeStyle: 'short',
			timeZone: 'UTC',
		}) + ' UTC'
	);
}
