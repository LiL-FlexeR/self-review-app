import type { ReactNode } from 'react';
import type { TChallenge } from '@self-review/contracts';

export interface IOtpFormProps {
	initialChallenge: TChallenge;
	onVerify(challengeId: string, code: string): Promise<void>;
	onResend(challengeId: string): Promise<TChallenge>;
	restartAction: ReactNode;
}
