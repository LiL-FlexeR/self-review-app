import type { ReactNode } from 'react';
import type { TIdentity } from '@self-review/contracts';
import type { IAppShellProps } from '@app/components/templates/AppShell/types';

export interface IAppShellLayoutProps extends IAppShellProps {
	user: TIdentity;
	busy: boolean;
	onLogout: () => void;
	feedback?: ReactNode;
}
