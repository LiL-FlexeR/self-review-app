import { ClipboardCheck } from 'lucide-react';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
} from '@app/components/ui/Card';
import type { IAuthPanelProps } from './types';

export function AuthPanel({ title, description, children, footer }: IAuthPanelProps) {
	return (
		<main
			id="content"
			aria-labelledby="auth-title"
			className="mx-auto my-6 w-[calc(100%-2rem)] max-w-(--content-width-auth) space-y-8 sm:my-12 lg:mt-[12vh]"
		>
			<div className="flex items-center justify-center gap-2 font-medium">
				<ClipboardCheck className="size-5 shrink-0" aria-hidden="true" />
				<span>Self Review</span>
			</div>
			<Card className="min-w-0 px-4 sm:px-8 sm:py-8">
				<CardHeader className="gap-2 px-0">
					<h1 id="auth-title" className="text-page-small wrap-anywhere md:text-page">
						{title}
					</h1>
					{description && (
						<CardDescription className="text-base leading-6">
							{description}
						</CardDescription>
					)}
				</CardHeader>
				<CardContent className="min-w-0 space-y-6 px-0">{children}</CardContent>
				{footer && (
					<CardFooter className="flex-col items-stretch gap-2 border-t px-0 text-ui">
						{footer}
					</CardFooter>
				)}
			</Card>
		</main>
	);
}
