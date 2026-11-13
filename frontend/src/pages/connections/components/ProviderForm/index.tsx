import { useId, useState } from 'react';
import { ExternalLink, KeyRound } from 'lucide-react';
import type { TTrackerCredentials } from '@self-review/contracts';
import { Button } from '@app/components/ui/Button';
import { DialogFooter } from '@app/components/ui/Dialog';
import { Input } from '@app/components/ui/Input';
import { Label } from '@app/components/ui/Label';
import { Status } from '@app/components/ui/Status';
import { PROVIDERS, type TLiveProvider } from '@app/pages/connections/connection-presentation';

interface IProviderFormProps {
	provider: TLiveProvider;
	displayName?: string;
	isReplacing: boolean;
	isPending: boolean;
	isOccupied: boolean;
	error?: string;
	onSubmit: (input: { displayName: string; credentials: TTrackerCredentials }) => void;
	onCancel: () => void;
}

export function ProviderForm({
	provider,
	displayName,
	isReplacing,
	isPending,
	isOccupied,
	error,
	onSubmit,
	onCancel,
}: IProviderFormProps) {
	const inputId = useId();
	const settings = PROVIDERS[provider];
	const [name, setName] = useState(displayName ?? settings.label);
	const [email, setEmail] = useState('');
	const [cloudId, setCloudId] = useState('');
	const [token, setToken] = useState('');
	return (
		<form
			className="space-y-6"
			aria-busy={isPending}
			onSubmit={(event) => {
				event.preventDefault();
				if (isPending || isOccupied) {
					return;
				}
				const credentials = provider === 'jira' ? { token, email, cloudId } : { token };
				setToken('');
				onSubmit({ credentials, displayName: name.trim() });
			}}
		>
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor={`${inputId}-name`}>Connection name</Label>
					<Input
						id={`${inputId}-name`}
						value={name}
						onChange={(event) => setName(event.target.value)}
						readOnly={isReplacing}
						required
						maxLength={100}
						disabled={isPending}
						aria-describedby={isReplacing ? `${inputId}-name-help` : undefined}
					/>
					{isReplacing && (
						<p id={`${inputId}-name-help`} className="text-sm text-muted-foreground">
							The saved name stays the same when replacing credentials.
						</p>
					)}
				</div>
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
								disabled={isPending}
								aria-describedby={`${inputId}-email-help`}
							/>
							<p
								id={`${inputId}-email-help`}
								className="text-sm text-muted-foreground"
							>
								Use your Atlassian email. It may differ from your application login.
							</p>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${inputId}-cloud`}>Jira cloudId</Label>
							<Input
								id={`${inputId}-cloud`}
								value={cloudId}
								onChange={(event) => setCloudId(event.target.value)}
								required
								pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
								disabled={isPending}
								aria-describedby={`${inputId}-cloud-help`}
							/>
							<p
								id={`${inputId}-cloud-help`}
								className="text-sm text-muted-foreground"
							>
								cloudId identifies one Jira Cloud site. Replacement requires the
								same site.{' '}
								<a
									className="underline underline-offset-4"
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
						{isReplacing
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
						disabled={isPending}
						aria-describedby={`${inputId}-help`}
					/>
					<p id={`${inputId}-help`} className="text-sm text-muted-foreground">
						{settings.instructions}{' '}
						<a
							className="inline-flex items-center gap-1 underline underline-offset-4"
							href={settings.href}
							target="_blank"
							rel="noreferrer"
						>
							Create a {settings.label} token{' '}
							<ExternalLink className="size-3" aria-hidden="true" />
						</a>
						.
					</p>
				</div>
				<p className="flex items-start gap-2 text-sm text-muted-foreground">
					<KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					<span>
						The API-confirmed token owner is the review subject. Tokens are cleared
						after submission and never displayed again.
					</span>
				</p>
				{isOccupied && (
					<Status variant="warning">
						This provider already has a saved connection. Close this form and use Manage
						to replace its credentials.
					</Status>
				)}
				{error && <Status variant="error">{error} Enter a new token to try again.</Status>}
				{isPending && (
					<p role="status" className="text-sm text-muted-foreground">
						Verifying credentials… You can close this dialog; the request continues and
						its result will appear on Connections.
					</p>
				)}
			</div>
			<DialogFooter className="flex-col sm:flex-row">
				<Button type="button" variant="outline" onClick={onCancel}>
					{isPending ? 'Close' : 'Cancel'}
				</Button>
				<Button
					type="submit"
					disabled={isPending || isOccupied || !token.trim() || !name.trim()}
					aria-busy={isPending}
				>
					{isPending
						? 'Verifying credentials…'
						: isReplacing
							? 'Verify and replace'
							: 'Verify and connect'}
				</Button>
			</DialogFooter>
		</form>
	);
}
