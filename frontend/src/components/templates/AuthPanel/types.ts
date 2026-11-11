import type { ReactNode } from 'react';

export interface IAuthPanelProps {
	title: string;
	description?: ReactNode;
	children: ReactNode;
}
