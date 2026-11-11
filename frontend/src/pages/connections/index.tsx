import { Card, CardContent, CardHeader, CardTitle } from '@app/components/ui/Card';
import { AppShell } from '@app/components/templates/AppShell';

export function ConnectionsPage() {
	return (
		<AppShell
			title="Connections"
			description="Connect your work to build an evidence-based self-review."
		>
			<Card className="py-8">
				<CardHeader className="px-8">
					<CardTitle>
						<h2 className="text-xl">Your account is ready</h2>
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 px-8">
					<p>
						Email verification is complete. Source connections and synchronization are
						the next stage.
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
