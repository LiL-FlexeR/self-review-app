import { useRef } from 'react';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from '@app/components/ui/Dialog';
import { ProviderForm } from '@app/pages/connections/components/ProviderForm';
import { PROVIDERS } from '@app/pages/connections/connection-presentation';
import type { TConnectionsWorkspace } from '@app/pages/connections/use-connections-workspace';

export function ConnectionDialog({ workspace }: { workspace: TConnectionsWorkspace }) {
	const { form, setForm, save, connections } = workspace;
	const opener = useRef<HTMLElement | null>(null);
	return (
		<Dialog
			open={!!form}
			onOpenChange={(open) => {
				if (!open) {
					setForm(undefined);
				}
			}}
		>
			<DialogContent
				aria-busy={save.isPending}
				className={
					form?.provider === 'jira'
						? 'max-w-[560px] bg-surface sm:max-w-[560px]'
						: 'max-w-[480px] bg-surface sm:max-w-[480px]'
				}
				onOpenAutoFocus={() => {
					opener.current =
						document.activeElement instanceof HTMLElement
							? document.activeElement
							: null;
				}}
				onCloseAutoFocus={(event) => {
					if (!opener.current?.isConnected || opener.current === document.body) {
						event.preventDefault();
						document
							.getElementById('connected-accounts-heading')
							?.focus({ preventScroll: true });
					}
				}}
			>
				<DialogHeader>
					<DialogTitle className="text-component">
						{form?.connectionId
							? 'Replace credentials'
							: `Connect ${form ? PROVIDERS[form.provider].label : 'provider'}`}
					</DialogTitle>
					<DialogDescription>
						{form?.connectionId
							? 'Verify a new token for the same tracker identity and connection scope.'
							: 'Connect a personal account to read projects and save evidence for your self-review.'}
					</DialogDescription>
				</DialogHeader>
				{form && (
					<ProviderForm
						key={form.key}
						provider={form.provider}
						isReplacing={!!form.connectionId}
						displayName={form.displayName}
						isPending={save.isPending}
						isOccupied={
							!form.connectionId &&
							!!connections.data?.items.some(
								(connection) => connection.provider === form.provider,
							)
						}
						error={save.error?.message}
						onCancel={() => setForm(undefined)}
						onSubmit={(input) => save.mutate({ ...input, form })}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}
