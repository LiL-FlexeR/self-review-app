import { useRef } from 'react';
import { Search, X as CloseIcon } from 'lucide-react';
import { Button } from '@app/components/ui/Button';
import { Input } from '@app/components/ui/Input';
import { Label } from '@app/components/ui/Label';
import { PROJECT_PROVIDERS } from '@app/pages/projects/catalog';
import type { TProviderFilter } from '@app/pages/projects/types';

export function FilterToolbar({
	search,
	provider,
	onSearch,
	onProvider,
}: {
	search: string;
	provider: TProviderFilter;
	onSearch: (value: string) => void;
	onProvider: (value: TProviderFilter) => void;
}) {
	const searchInput = useRef<HTMLInputElement>(null);

	return (
		<div
			role="search"
			aria-label="Loaded project catalog"
			className="flex min-w-0 flex-col gap-4 @min-[640px]/workspace:flex-row @min-[640px]/workspace:items-end"
		>
			<div className="min-w-0 flex-1 space-y-2">
				<Label htmlFor="project-search">Search loaded projects</Label>
				<div className="relative">
					<Search
						aria-hidden="true"
						className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						ref={searchInput}
						id="project-search"
						type="search"
						value={search}
						onChange={(event) => onSearch(event.target.value)}
						className="pl-10"
						placeholder="Name, ID or location"
						aria-describedby="project-search-scope"
					/>
				</div>
			</div>
			<div className="min-w-0 space-y-2 @min-[640px]/workspace:w-48">
				<Label htmlFor="project-provider">Provider</Label>
				<select
					id="project-provider"
					value={provider}
					onChange={(event) => {
						const option = PROJECT_PROVIDERS.find(
							(candidate) => candidate.value === event.target.value,
						);
						if (option) {
							onProvider(option.value);
						}
					}}
					className="h-11 w-full min-w-0 rounded-inputs border border-input bg-background px-3 text-base md:h-10 md:text-ui"
				>
					{PROJECT_PROVIDERS.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			</div>
			{(search || provider !== 'all') && (
				<Button
					variant="ghost"
					onClick={() => {
						onSearch('');
						onProvider('all');
						searchInput.current?.focus();
					}}
				>
					<CloseIcon aria-hidden="true" /> Clear filters
				</Button>
			)}
		</div>
	);
}
