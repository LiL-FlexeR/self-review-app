import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@app/components/ui/Button';
import { Skeleton } from '@app/components/ui/Skeleton';
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@app/components/ui/Table';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@app/components/ui/Tooltip';
import { projectProviderLabel } from '@app/pages/projects/catalog';
import type { TProjectRow } from '@app/pages/projects/types';
import { ProjectIdentifier } from '@app/pages/projects/components/ProjectIdentifier';

export function ProjectTable({
	rows,
	emptyMessage,
	isLoading = false,
}: {
	rows: TProjectRow[];
	emptyMessage: string;
	isLoading?: boolean;
}) {
	return (
		<div
			role="region"
			aria-label="Loaded projects table"
			tabIndex={0}
			aria-busy={isLoading && rows.length === 0}
			className="min-w-0 overflow-x-auto overscroll-x-contain rounded-md border"
		>
			<TooltipProvider delayDuration={300}>
				<Table className="min-w-[880px] table-fixed [&_td]:px-3 [&_th]:px-3">
					<colgroup>
						<col className="w-[15%]" />
						<col className="w-[19%]" />
						<col className="w-[28%]" />
						<col className="w-[29%]" />
						<col className="w-[9%]" />
					</colgroup>
					<TableCaption className="sr-only">
						Accessible resources from your connected sources. Search and filters apply
						only to loaded projects.
					</TableCaption>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead scope="col">Provider</TableHead>
							<TableHead scope="col">ID</TableHead>
							<TableHead scope="col">Name</TableHead>
							<TableHead scope="col">Workspace / Location</TableHead>
							<TableHead scope="col" className="text-right">
								Actions
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading &&
							rows.length === 0 &&
							[0, 1, 2].map((index) => (
								<TableRow key={index} aria-hidden="true">
									<TableCell colSpan={5}>
										<Skeleton className="my-2 h-5 w-3/4" />
									</TableCell>
								</TableRow>
							))}
						{rows.map(({ project, connection }) => (
							<TableRow key={project.id}>
								<TableCell className="wrap-anywhere">
									{projectProviderLabel(connection.provider)}
								</TableCell>
								<TableCell>
									<ProjectIdentifier
										value={project.externalId}
										name={project.name}
									/>
								</TableCell>
								<TableCell>
									<Link
										to={`/projects/${project.id}`}
										className="inline-flex min-h-11 max-w-full min-w-0 items-center py-1 font-medium underline-offset-4 hover:underline md:min-h-8 wrap-anywhere"
									>
										{project.name}
									</Link>
									{connection.provider === 'clickup' && (
										<p className="text-metadata text-muted-foreground">List</p>
									)}
								</TableCell>
								<TableCell className="space-y-1 wrap-anywhere">
									<p>
										{project.breadcrumb.length > 0
											? project.breadcrumb.join(' / ')
											: 'Location not provided'}
									</p>
									<p className="text-metadata text-muted-foreground">
										{connection.displayName}
									</p>
								</TableCell>
								<TableCell className="text-right">
									<Tooltip>
										<TooltipTrigger asChild>
											<Button variant="ghost" size="icon" asChild>
												<Link
													to={`/projects/${project.id}`}
													aria-label={`Open ${project.name}`}
												>
													<ArrowRight aria-hidden="true" />
												</Link>
											</Button>
										</TooltipTrigger>
										<TooltipContent className="max-w-64 wrap-anywhere">
											Open {project.name}
										</TooltipContent>
									</Tooltip>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</TooltipProvider>
			{rows.length === 0 && (
				<p className="px-4 py-8 text-ui text-muted-foreground">{emptyMessage}</p>
			)}
		</div>
	);
}
