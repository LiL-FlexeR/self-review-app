import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@app/components/ui/Button';
import { Input } from '@app/components/ui/Input';
import { Status } from '@app/components/ui/Status';
import { Label } from '@app/components/ui/Label';
import { AuthPanel } from '@app/components/templates/AuthPanel';
import type { IOtpFormProps } from './types';

export function OtpForm({ initialChallenge, onVerify, onResend, restartAction }: IOtpFormProps) {
	const [challenge, setChallenge] = useState(initialChallenge);
	const [code, setCode] = useState('');
	const [feedback, setFeedback] = useState<{
		message: string;
		variant: 'success' | 'error';
	}>();
	const [busy, setBusy] = useState(false);
	const [tick, setTick] = useState(Date.now);

	useEffect(() => {
		const timer = setInterval(() => setTick(Date.now()), 1000);

		return () => clearInterval(timer);
	}, []);

	const remaining = Math.max(0, Math.ceil((Date.parse(challenge.resendAt) - tick) / 1000));
	const expired = Date.parse(challenge.expiresAt) <= tick;

	async function verify(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setFeedback(undefined);

		try {
			await onVerify(challenge.challengeId, code);
			setCode('');
		} catch (error) {
			setFeedback({ message: (error as Error).message, variant: 'error' });
		} finally {
			setBusy(false);
		}
	}

	async function resend() {
		setBusy(true);
		setFeedback(undefined);

		try {
			setChallenge(await onResend(challenge.challengeId));
			setCode('');
			setFeedback({
				message: 'A new code was sent. The previous code no longer works.',
				variant: 'success',
			});
		} catch (error) {
			setFeedback({ message: (error as Error).message, variant: 'error' });
		} finally {
			setBusy(false);
		}
	}

	return (
		<AuthPanel title="Check your email">
			<p>Enter the six-digit code sent to {challenge.maskedEmail}.</p>
			<p className="text-sm text-muted-foreground">
				{expired
					? 'Code expired. Start sign-in again.'
					: `Expires at ${new Date(challenge.expiresAt).toLocaleTimeString()}.`}
			</p>
			{challenge.mailDelivery === 'local' ? (
				<a
					className="inline-block underline"
					href="http://localhost:8025"
					target="_blank"
					rel="noreferrer"
				>
					Open email in Mailpit ↗
				</a>
			) : (
				<p className="text-sm text-muted-foreground">
					Open your email inbox to find the code.
				</p>
			)}
			<form className="grid gap-4" onSubmit={(event) => void verify(event)} aria-busy={busy}>
				<div className="grid gap-2">
					<Label htmlFor="verification-code">Verification code</Label>
					<Input
						id="verification-code"
						name="code"
						value={code}
						onChange={(event) => setCode(event.target.value)}
						inputMode="numeric"
						autoComplete="one-time-code"
						pattern="[0-9]{6}"
						minLength={6}
						maxLength={6}
						required
						autoFocus
						aria-describedby="code-hint"
					/>
				</div>
				<span className="text-sm text-muted-foreground" id="code-hint">
					Use the latest email. This code works only in this browser.
				</span>
				<Button disabled={busy || expired}>
					{busy ? 'Please wait…' : 'Verify and sign in'}
				</Button>
			</form>
			{feedback && <Status variant={feedback.variant}>{feedback.message}</Status>}
			<Button
				variant="outline"
				disabled={busy || remaining > 0 || expired}
				onClick={() => void resend()}
			>
				{remaining ? `Resend in ${remaining}s` : 'Resend code'}
			</Button>
			<p className="text-sm text-muted-foreground underline">{restartAction}</p>
		</AuthPanel>
	);
}
