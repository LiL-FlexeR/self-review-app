import type { ReactNode } from 'react';
import type { IPageHeaderProps } from '@app/components/templates/PageHeader/types';

export interface IAppShellProps extends IPageHeaderProps {
	contentWidth?: 'connections' | 'projects' | 'workspace' | 'reading' | 'full';
	children: ReactNode;
}
