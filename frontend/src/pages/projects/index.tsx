import { Card, CardContent, CardHeader, CardTitle } from '@app/components/ui/Card';
import { AppShell } from '@app/components/templates/AppShell';

export function ProjectsPage() {
	return (
		<AppShell title="Projects" description="Saved project work will appear here.">
			<Card className="py-8">
				<CardHeader className="px-8">
					<CardTitle>
						<h2 className="text-xl">No projects yet</h2>
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 px-8">
					<p>
						Project discovery and saved snapshots arrive with the next implementation
						stage.
					</p>
					<p className="text-sm text-muted-foreground">
						S01 provides authentication and the application shell. Tracker connections,
						jobs and model calls are not available yet.
					</p>
				</CardContent>
			</Card>
		</AppShell>
	);
}
