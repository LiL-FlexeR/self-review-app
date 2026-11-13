import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@app/components/ui/Button';

export function ProjectIdentifier({ value, name }: { value: string; name: string }) {
	const [status, setStatus] = useState('');
	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			setStatus('Copied');
		} catch {
			setStatus('Copy unavailable. Select the full ID to copy it.');
		}
	}

	if (value.length <= 22) {
		return <span className="font-mono text-identifier select-all wrap-anywhere">{value}</span>;
	}

	return (
		<details className="min-w-0">
			<summary
				className="min-h-11 cursor-pointer content-center rounded-md font-mono text-identifier md:min-h-8"
				aria-label={`Show full project ID for ${name}`}
			>
				<span className="inline-block max-w-28 truncate align-bottom" aria-hidden="true">
					{value}
				</span>
			</summary>
			<div className="mt-2 space-y-2">
				<p className="font-mono text-identifier select-all wrap-anywhere">{value}</p>
				<Button
					variant="ghost"
					size="sm"
					aria-label={`Copy project ID for ${name}`}
					onClick={() => void copy()}
				>
					{status === 'Copied' ? (
						<Check aria-hidden="true" />
					) : (
						<Copy aria-hidden="true" />
					)}
					Copy ID
				</Button>
				<p role="status" className="text-metadata text-muted-foreground">
					{status}
				</p>
			</div>
		</details>
	);
}
