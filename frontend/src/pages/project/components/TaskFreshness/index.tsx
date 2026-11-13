import { Copy, RotateCw, TriangleAlert, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const FRESHNESS: Record<string, { label: string; icon: LucideIcon; description: string }> = {
	fresh: {
		label: 'Fresh',
		icon: RotateCw,
		description: 'Retrieved for this snapshot. The source may have changed since.',
	},
	copied: {
		label: 'Copied',
		icon: Copy,
		description: 'Retained from a previous snapshot with its original retrieval time.',
	},
	stale: {
		label: 'Stale',
		icon: TriangleAlert,
		description:
			'Refresh failed. Previous saved data and its original retrieval time were retained.',
	},
};

export function TaskFreshness({ status }: { status: string }) {
	const presentation = FRESHNESS[status] ?? {
		label: status,
		icon: Info,
		description: 'Saved retrieval provenance.',
	};
	const Icon = presentation.icon;
	return (
		<span
			title={presentation.description}
			className={`inline-flex w-fit items-center gap-1.5 rounded-chips border px-2 py-0.5 text-metadata ${status === 'stale' ? 'border-warning bg-warning-surface' : 'border-border text-foreground'}`}
		>
			<Icon className="size-3.5 shrink-0" aria-hidden="true" />
			{presentation.label}
		</span>
	);
}
