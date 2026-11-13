import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowUpRight, CircleX } from 'lucide-react';
import { HTTP_ERROR_CODE } from '@self-review/contracts';
import { ClientError } from '@app/auth/coordinator';
import { Button } from '@app/components/ui/Button';
import { Input } from '@app/components/ui/Input';
import { Status } from '@app/components/ui/Status';
import { Label } from '@app/components/ui/Label';
import { AuthPanel } from '@app/components/templates/AuthPanel';
import type { IOtpFormProps } from './types';

export function OtpForm({ initialChallenge, onVerify, onResend, restartAction }: IOtpFormProps) {
	const [challenge, setChallenge] = useState(initialChallenge);
	const [code, setCode] = useState('');
	const [error, setError] = useState<{
		message: string;
		isCodeError: boolean;
		action: 'verify' | 'resend';
	}>();
	const [validationError, setValidationError] = useState('');
	const [resendMessage, setResendMessage] = useState('');
	const [pendingAction, setPendingAction] = useState<'verify' | 'resend' | null>(null);
	const [tick, setTick] = useState(Date.now);
	const codeInput = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const timer = setInterval(() => setTick(Date.now()), 1000);

		return () => clearInterval(timer);
	}, []);

	const remaining = Math.max(0, Math.ceil((Date.parse(challenge.resendAt) - tick) / 1000));
	const isExpired = Date.parse(challenge.expiresAt) <= tick;
	const isBusy = pendingAction !== null;
	let resendLabel = remaining > 0 ? `Resend in ${remaining}s` : 'Resend code';

	if (pendingAction === 'resend') {
		resendLabel = 'Sending new code…';
	}

	async function verify(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (isBusy || isExpired) {
			return;
		}

		setPendingAction('verify');
		setError(undefined);
		setValidationError('');
		setResendMessage('');

		try {
			await onVerify(challenge.challengeId, code);
			setCode('');
		} catch (error) {
			const isCodeError =
				error instanceof ClientError && error.code === HTTP_ERROR_CODE.OTP_INVALID;

			setError({ message: (error as Error).message, isCodeError, action: 'verify' });

			if (isCodeError) {
				codeInput.current?.focus();
			}
		} finally {
			setPendingAction(null);
		}
	}

	async function resend() {
		if (isBusy || remaining > 0 || isExpired) {
			return;
		}

		setPendingAction('resend');
		setError(undefined);
		setValidationError('');
		setResendMessage('');

		try {
			setChallenge(await onResend(challenge.challengeId));
			setCode('');
			setTick(Date.now());
			setResendMessage('A new code was sent. The previous code no longer works.');
			codeInput.current?.focus();
		} catch (error) {
			setError({ message: (error as Error).message, isCodeError: false, action: 'resend' });
		} finally {
			setPendingAction(null);
		}
	}

	return (
		<AuthPanel
			title="Check your email"
			description="Enter the six-digit code to finish signing in."
			footer={
				<>
					<p className="text-muted-foreground">
						Need a different email or a fresh start?
					</p>
					{restartAction}
				</>
			}
		>
			<section aria-label="Email delivery details" className="space-y-2 border-y py-4">
				<p className="text-ui text-muted-foreground">Code sent to</p>
				<p className="font-medium wrap-anywhere">{challenge.maskedEmail}</p>
				{!isExpired && (
					<p className="text-ui text-muted-foreground">
						Expires at{' '}
						<time dateTime={challenge.expiresAt}>
							{new Date(challenge.expiresAt).toLocaleTimeString([], {
								hour: 'numeric',
								minute: '2-digit',
								timeZoneName: 'short',
							})}
						</time>
					</p>
				)}
				{challenge.mailDelivery === 'local' ? (
					<a
						className="inline-flex min-h-11 items-center gap-1 rounded-button-quiet text-ui underline md:min-h-10"
						href="http://localhost:8025"
						target="_blank"
						rel="noreferrer"
					>
						Open email in Mailpit
						<ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
						<span className="sr-only"> (opens in a new tab)</span>
					</a>
				) : (
					<p className="text-ui text-muted-foreground">
						Open your email inbox to find the latest code.
					</p>
				)}
			</section>
			{isExpired && (
				<Status variant="warning">
					This code has expired. Start again with your email and password to get a new
					code.
				</Status>
			)}
			<form className="space-y-6" onSubmit={(event) => void verify(event)} aria-busy={isBusy}>
				<div className="grid gap-2">
					<Label htmlFor="verification-code">Verification code</Label>
					<Input
						ref={codeInput}
						id="verification-code"
						name="code"
						type="text"
						className="font-mono tabular-nums"
						value={code}
						onChange={(event) => {
							setCode(event.target.value);
							setValidationError('');

							if (error?.isCodeError) {
								setError(undefined);
							}
						}}
						onInvalid={() =>
							setValidationError('Enter the six-digit code from your latest email.')
						}
						inputMode="numeric"
						autoComplete="one-time-code"
						pattern="[0-9]{6}"
						minLength={6}
						maxLength={6}
						required
						autoFocus
						aria-invalid={Boolean(validationError || error?.isCodeError)}
						aria-describedby={[
							'code-hint',
							validationError && 'code-error',
							error?.isCodeError && 'verification-error',
						]
							.filter(Boolean)
							.join(' ')}
					/>
					<p className="text-ui text-muted-foreground" id="code-hint">
						Use the latest email. This code works only in this browser.
					</p>
					{validationError && (
						<p
							id="code-error"
							role="alert"
							className="flex items-start gap-2 text-ui wrap-anywhere text-error"
						>
							<CircleX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
							{validationError}
						</p>
					)}
				</div>
				{error?.action === 'verify' && (
					<div id="verification-error">
						<Status variant="error">{error.message}</Status>
					</div>
				)}
				<Button className="w-full" disabled={isBusy || isExpired}>
					{pendingAction === 'verify' ? 'Verifying code…' : 'Verify and sign in'}
				</Button>
			</form>
			<div className="space-y-3">
				<p className="text-ui text-muted-foreground">Didn’t get the email?</p>
				<Button
					type="button"
					variant="outline"
					className="w-full tabular-nums"
					disabled={isBusy || remaining > 0 || isExpired}
					aria-busy={pendingAction === 'resend'}
					aria-describedby="resend-hint"
					onClick={() => void resend()}
				>
					{resendLabel}
				</Button>
				<p id="resend-hint" className="text-ui text-muted-foreground">
					{isExpired
						? 'Start again below to request a new code.'
						: 'Sending a new code replaces the previous one.'}
				</p>
				{error?.action === 'resend' && <Status variant="error">{error.message}</Status>}
				{resendMessage && <Status variant="success">{resendMessage}</Status>}
			</div>
		</AuthPanel>
	);
}
