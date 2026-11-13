import { NavLink, useLocation } from 'react-router';
import { ClipboardCheck, FolderKanban, Link2, LogOut, UserRound } from 'lucide-react';
import { Button } from '@app/components/ui/Button';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from '@app/components/ui/Sidebar';
import type { IAppSidebarProps } from './types';

const NAVIGATION = [
	{ to: '/connections', label: 'Connections', icon: Link2 },
	{ to: '/projects', label: 'Projects', icon: FolderKanban },
];

export function AppSidebar({ user, busy, onLogout }: IAppSidebarProps) {
	const location = useLocation();
	const { setOpenMobile } = useSidebar();

	return (
		<Sidebar>
			<SidebarHeader className="flex-row items-center gap-2 px-4 py-6">
				<ClipboardCheck className="size-5" aria-hidden="true" />
				<span className="font-medium">Self Review</span>
			</SidebarHeader>
			<SidebarContent className="px-4">
				<nav aria-label="Main navigation">
					<SidebarMenu className="gap-2">
						{NAVIGATION.map(({ to, label, icon: Icon }) => (
							<SidebarMenuItem key={to}>
								<SidebarMenuButton
									asChild
									size="lg"
									isActive={
										location.pathname === to ||
										location.pathname.startsWith(to + '/')
									}
									className="h-11 rounded-xl px-3 text-ui data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
								>
									<NavLink to={to} onClick={() => setOpenMobile(false)}>
										<Icon aria-hidden="true" />
										<span>{label}</span>
									</NavLink>
								</SidebarMenuButton>
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</nav>
			</SidebarContent>
			<SidebarFooter className="gap-2 border-t p-4">
				<div className="flex min-w-0 items-start gap-2">
					<UserRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					<div className="min-w-0 space-y-1">
						<p className="text-ui font-medium">Application account</p>
						<p className="text-ui wrap-anywhere text-muted-foreground">
							{user.user.email}
						</p>
					</div>
				</div>
				<Button
					variant="ghost"
					className="justify-start"
					disabled={busy}
					onClick={onLogout}
				>
					<LogOut aria-hidden="true" />
					{busy ? 'Signing out…' : 'Sign out'}
				</Button>
				<details className="min-w-0 text-ui text-muted-foreground">
					<summary className="cursor-pointer rounded-button-quiet py-2 text-foreground">
						Account and session help
					</summary>
					<p className="pt-2 pb-1">
						Signing out prevents future renewal. Issued access tokens expire within 15
						minutes. Accepted background work continues after sign-out.
					</p>
				</details>
			</SidebarFooter>
		</Sidebar>
	);
}
