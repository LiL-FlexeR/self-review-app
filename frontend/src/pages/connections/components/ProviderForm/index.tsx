import { useId, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { TTrackerCredentials } from '@self-review/contracts';
import { ConnectionView } from '@self-review/contracts';
import { auth, queryClient } from '@app/auth/session';
import { command } from '@app/lib/api';
import { Button } from '@app/components/ui/Button';
import { Input } from '@app/components/ui/Input';
import { Label } from '@app/components/ui/Label';
import { Status } from '@app/components/ui/Status';

const PROVIDERS = {
	linear: {
		label: 'Linear',
		tokenLabel: 'Personal API key',
		instructions: 'Use a Read key, restricted to the intended teams where possible.',
		href: 'https://linear.app/docs/security-and-access#personal-api-keys',
	},
	clickup: {
		label: 'ClickUp',
		tokenLabel: 'Personal API token',
		instructions:
			'Use a personal token. Lists are synchronized with their workspace, Space and Folder path.',
		href: 'https://developer.clickup.com/docs/authentication',
	},
	jira: {
		label: 'Jira Cloud',
		tokenLabel: 'Scoped personal API token',
		instructions:
			'Use a scoped token with permission to read your profile, projects, issues and comments. The Atlassian email may differ from your app login.',
		href: 'https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/',
	},
};

export function ProviderForm({
	userId,
	connectionId,
	provider,
}: {
	userId: string;
	connectionId?: string;
	provider: keyof typeof PROVIDERS;
}) {
	const inputId = useId();
	const settings = PROVIDERS[provider];
	const [name, setName] = useState(settings.label);
	const [email, setEmail] = useState('');
	const [cloudId, setCloudId] = useState('');
	const [token, setToken] = useState('');
	const save = useMutation({
		retry: false,
		mutationFn: async (input: { credentials: TTrackerCredentials; displayName: string }) => {
			const credentials = input.credentials;
			if (connectionId) {
				return ConnectionView.parse(
					await auth.request(`/connections/${connectionId}`, {
						method: 'PUT',
						body: JSON.stringify({ credentials }),
					}),
				);
			}
			return command(
				'/connections',
				{
					provider,
					displayName: input.displayName,
					credentials,
				},
				ConnectionView,
			);
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: [userId] }),
	});
	return (
		<form
			className="space-y-4"
			onSubmit={(event) => {
				event.preventDefault();
				const credentials = provider === 'jira' ? { token, email, cloudId } : { token };
				setToken('');
				save.mutate({ credentials, displayName: name });
			}}
		>
			{!connectionId && (
				<div className="space-y-2">
					<Label htmlFor={`${inputId}-name`}>Connection name</Label>
					<Input
						id={`${inputId}-name`}
						value={name}
						onChange={(event) => setName(event.target.value)}
						required
						maxLength={100}
						disabled={save.isPending}
					/>
				</div>
			)}

			{provider === 'jira' && (
				<>
					<div className="space-y-2">
						<Label htmlFor={`${inputId}-email`}>Atlassian account email</Label>
						<Input
							id={`${inputId}-email`}
							type="email"
							autoComplete="off"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							required
							maxLength={320}
							disabled={save.isPending}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor={`${inputId}-cloud`}>Jira cloudId</Label>
						<Input
							id={`${inputId}-cloud`}
							value={cloudId}
							onChange={(event) => setCloudId(event.target.value)}
							required
							pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
							disabled={save.isPending}
							aria-describedby={`${inputId}-cloud-help`}
						/>
						<p id={`${inputId}-cloud-help`} className="text-sm text-muted-foreground">
							cloudId identifies one Jira Cloud site. Replacement requires the same
							site.{' '}
							<a
								className="underline"
								href="https://support.atlassian.com/jira/kb/retrieve-my-atlassian-sites-cloud-id/"
								target="_blank"
								rel="noreferrer"
							>
								Find your cloudId
							</a>
							.
						</p>
					</div>
				</>
			)}

			<div className="space-y-2">
				<Label htmlFor={`${inputId}-token`}>
					{connectionId
						? `Replacement ${settings.tokenLabel.toLowerCase()}`
						: settings.tokenLabel}
				</Label>
				<Input
					id={`${inputId}-token`}
					type="password"
					autoComplete="off"
					spellCheck={false}
					value={token}
					onChange={(event) => setToken(event.target.value)}
					required
					maxLength={4096}
					disabled={save.isPending}
					aria-describedby={`${inputId}-help`}
				/>
				<p id={`${inputId}-help`} className="text-sm text-muted-foreground">
					{settings.instructions} The API-confirmed token owner becomes the review
					subject.{' '}
					<a className="underline" href={settings.href} target="_blank" rel="noreferrer">
						Create a {settings.label} token
					</a>
					.
				</p>
			</div>
			<Button
				type="submit"
				disabled={save.isPending || !token.trim() || (!connectionId && !name.trim())}
			>
				{save.isPending
					? 'Verifying credentials…'
					: connectionId
						? 'Verify and replace credentials'
						: 'Verify and save'}
			</Button>
			{save.error && <Status>{save.error.message}</Status>}
			{save.isSuccess && (
				<Status>Credentials verified and saved. Credentials are never displayed.</Status>
			)}
		</form>
	);
}
