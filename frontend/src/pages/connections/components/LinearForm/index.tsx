import { useId, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ConnectionView } from '@self-review/contracts';
import { auth, queryClient } from '@app/auth/session';
import { command } from '@app/lib/api';
import { Button } from '@app/components/ui/Button';
import { Input } from '@app/components/ui/Input';
import { Label } from '@app/components/ui/Label';
import { Status } from '@app/components/ui/Status';

export function LinearForm({ userId, connectionId }: { userId: string; connectionId?: string }) {
	const inputId = useId();
	const [name, setName] = useState('Linear');
	const [token, setToken] = useState('');
	const save = useMutation({
		retry: false,
		mutationFn: async (credentials: { token: string; displayName: string }) => {
			if (connectionId) {
				return ConnectionView.parse(
					await auth.request(`/connections/${connectionId}`, {
						method: 'PUT',
						body: JSON.stringify({ credentials: { token: credentials.token } }),
					}),
				);
			}
			return command(
				'/connections',
				{
					provider: 'linear',
					displayName: credentials.displayName,
					credentials: { token: credentials.token },
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
				const credentials = { token, displayName: name };
				setToken('');
				save.mutate(credentials);
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
			<div className="space-y-2">
				<Label htmlFor={`${inputId}-token`}>
					{connectionId ? 'Replacement personal API key' : 'Personal API key'}
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
					Use a Read key, restricted to the intended teams where possible. The token owner
					becomes the review subject.{' '}
					<a
						className="underline"
						href="https://linear.app/docs/security-and-access#personal-api-keys"
						target="_blank"
						rel="noreferrer"
					>
						Create a Linear key
					</a>
					.
				</p>
			</div>
			<Button
				type="submit"
				disabled={save.isPending || !token.trim() || (!connectionId && !name.trim())}
			>
				{save.isPending
					? 'Verifying key…'
					: connectionId
						? 'Verify and replace key'
						: 'Verify and save'}
			</Button>
			{save.error && <Status>{save.error.message}</Status>}
			{save.isSuccess && (
				<Status>Key verified and saved. Credentials are never displayed.</Status>
			)}
		</form>
	);
}
