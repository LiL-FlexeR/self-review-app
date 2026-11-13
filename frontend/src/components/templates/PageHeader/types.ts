import type { ReactNode } from 'react';

export interface IPageHeaderProps {
	title: string;
	description?: string;
	actions?: ReactNode;
}
