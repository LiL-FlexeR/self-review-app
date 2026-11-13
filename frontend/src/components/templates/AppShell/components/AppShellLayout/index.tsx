import { SidebarInset, SidebarProvider, SidebarTrigger } from '@app/components/ui/Sidebar';
import { AppSidebar } from '@app/components/templates/AppShell/components/AppSidebar';
import { PageHeader } from '@app/components/templates/PageHeader';
import { cn } from '@app/lib/utils';
import type { IAppShellLayoutProps } from './types';

const CONTENT_WIDTHS = {
	connections: 'max-w-(--content-width-connections)',
	projects: 'max-w-(--content-width-projects)',
	workspace: 'max-w-(--content-width-workspace)',
	reading: 'max-w-(--content-width-reading)',
	full: 'max-w-none',
};

const MODE_LABELS = {
	offline: { label: 'Offline mode', detail: 'Synthetic source · scripted model' },
	demo: { label: 'Demo mode', detail: 'Synthetic source · live model' },
	live: { label: 'Live mode', detail: 'Trackers enabled · live model' },
};

export function AppShellLayout({
	title,
	description,
	actions,
	contentWidth = 'workspace',
	user,
	busy,
	onLogout,
	feedback,
	children,
}: IAppShellLayoutProps) {
	return (
		<SidebarProvider>
			<a
				className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:p-2"
				href="#content"
			>
				Skip to content
			</a>
			<AppSidebar user={user} busy={busy} onLogout={onLogout} />
			<SidebarInset
				id="content"
				tabIndex={-1}
				className="min-w-0 px-4 py-6 md:px-6 md:py-8 lg:px-8"
			>
				<div
					data-content-width={contentWidth}
					className={cn(
						'mx-auto flex w-full min-w-0 flex-col gap-6',
						CONTENT_WIDTHS[contentWidth],
					)}
				>
					<div className="flex min-w-0 items-center gap-3">
						<SidebarTrigger />
						<div
							aria-label="Runtime mode"
							className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-ui"
						>
							<span className="font-medium">{MODE_LABELS[user.mode].label}</span>
							<span className="text-muted-foreground">
								{MODE_LABELS[user.mode].detail}
							</span>
						</div>
					</div>
					<PageHeader title={title} description={description} actions={actions} />
					{feedback}
					{children}
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
