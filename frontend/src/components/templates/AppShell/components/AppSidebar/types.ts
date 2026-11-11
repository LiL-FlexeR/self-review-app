import type { TIdentity } from '@self-review/contracts';

export interface IAppSidebarProps {
	user: TIdentity;
	busy: boolean;
	onLogout: () => void;
}
