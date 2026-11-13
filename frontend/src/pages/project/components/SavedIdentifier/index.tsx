import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@app/components/ui/Button';

export function SavedIdentifier({ label, value }: { label: string; value: string }) {
	const [status, setStatus] = useState('');
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(value);
			setStatus('Copied');
		} catch {
			setStatus('Copy unavailable. Select the identifier to copy it.');
		}
	};

	return (
		<div className="space-y-1">
			<dt className="text-muted-foreground">{label}</dt>
			<dd>
				<div className="flex min-w-0 items-start gap-2">
					<span className="min-w-0 flex-1 py-2 font-mono text-identifier select-all wrap-anywhere">
						{value}
					</span>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={`Copy ${label}`}
						onClick={() => {
							void copy();
						}}
					>
						{status === 'Copied' ? (
							<Check aria-hidden="true" />
						) : (
							<Copy aria-hidden="true" />
						)}
					</Button>
				</div>
				<p role="status" className="text-metadata text-muted-foreground">
					{status}
				</p>
			</dd>
		</div>
	);
}
