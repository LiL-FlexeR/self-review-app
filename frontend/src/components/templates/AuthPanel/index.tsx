import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/components/ui/Card';
import type { IAuthPanelProps } from './types';

export function AuthPanel({ title, description, children }: IAuthPanelProps) {
	return (
		<main
			id="content"
			className="mx-auto mt-8 mb-8 w-[calc(100%-2rem)] max-w-[440px] sm:mt-[12vh]"
		>
			<Card className="sm:py-8">
				<CardHeader className="gap-4 sm:px-8">
					<span className="font-medium tracking-[0.01em]">Self Review</span>
					<CardTitle>
						<h1 className="text-[28px] leading-tight">{title}</h1>
					</CardTitle>
					{description && <CardDescription>{description}</CardDescription>}
				</CardHeader>
				<CardContent className="space-y-6 sm:px-8">{children}</CardContent>
			</Card>
		</main>
	);
}
