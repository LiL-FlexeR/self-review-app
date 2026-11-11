import { NavLink, useLocation } from 'react-router';
import { FolderKanban, Link2 } from 'lucide-react';
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
			<SidebarHeader className="px-4 pt-8 pb-6">
				<span className="font-medium tracking-[0.01em]">Self Review</span>
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
									className="rounded-xl px-3 text-base data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
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
			<SidebarFooter className="gap-3 px-4 py-8">
				<p className="text-sm text-muted-foreground">Application account</p>
				<p className="text-sm wrap-anywhere">{user.user.email}</p>
				<Button variant="outline" disabled={busy} onClick={onLogout}>
					{busy ? 'Signing out…' : 'Sign out'}
				</Button>
			</SidebarFooter>
		</Sidebar>
	);
}
