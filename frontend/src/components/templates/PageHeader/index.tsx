import type { IPageHeaderProps } from './types';

export function PageHeader({ title, description, actions }: IPageHeaderProps) {
	return (
		<header className="flex min-w-0 flex-col gap-4 md:flex-row md:flex-wrap md:items-start md:justify-between md:gap-6">
			<div className="min-w-0 space-y-2 md:basis-64 md:grow">
				<h1 className="text-page-small wrap-anywhere md:text-page">{title}</h1>
				{description && (
					<p className="max-w-prose text-ui text-muted-foreground">{description}</p>
				)}
			</div>
			{actions && (
				<div
					role="group"
					aria-label="Page actions"
					className="flex min-w-0 max-w-full flex-wrap items-center gap-2"
				>
					{actions}
				</div>
			)}
		</header>
	);
}
