import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { CircleX } from 'lucide-react';
import { Challenge, Credentials, HTTP_ERROR_CODE } from '@self-review/contracts';
import { ClientError } from '@app/auth/coordinator';
import { auth } from '@app/auth/session';
import { Button } from '@app/components/ui/Button';
import { Input } from '@app/components/ui/Input';
import { Status } from '@app/components/ui/Status';
import { Label } from '@app/components/ui/Label';
import { AuthPanel } from '@app/components/templates/AuthPanel';

type TCredentialField = 'email' | 'password';

export function LoginForm() {
	const location = useLocation();
	const navigate = useNavigate();
	const isSignup = location.pathname === '/register';
	const [error, setError] = useState('');
	const [fieldErrors, setFieldErrors] = useState<Partial<Record<TCredentialField, string>>>({});
	const [hasInvalidCredentials, setHasInvalidCredentials] = useState(false);
	const [isBusy, setIsBusy] = useState(false);

	function setFieldError(field: TCredentialField, message: string) {
		setFieldErrors((previous) => ({ ...previous, [field]: message }));
	}

	function clearFieldError(field: TCredentialField) {
		setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
		setHasInvalidCredentials(false);
		setError('');
	}

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (isBusy) {
			return;
		}

		setError('');
		setHasInvalidCredentials(false);
		setFieldErrors({});

		const form = event.currentTarget;
		const values = Object.fromEntries(new FormData(form));
		const parsedCredentials = Credentials.safeParse(values);

		if (!parsedCredentials.success) {
			const nextErrors: Partial<Record<TCredentialField, string>> = {};

			for (const issue of parsedCredentials.error.issues) {
				if (issue.path[0] === 'email') {
					nextErrors.email = 'Enter a valid email address.';
				}
				if (issue.path[0] === 'password') {
					nextErrors.password = 'Use a password of 12–128 characters.';
				}
			}

			setFieldErrors(nextErrors);
			const firstInvalidField = form.elements.namedItem(
				nextErrors.email ? 'email' : 'password',
			);

			if (firstInvalidField instanceof HTMLInputElement) {
				firstInvalidField.focus();
			}

			return;
		}

		setIsBusy(true);

		try {
			const challenge = Challenge.parse(
				await auth.raw(isSignup ? '/auth/signup' : '/auth/login', {
					method: 'POST',
					body: JSON.stringify(parsedCredentials.data),
				}),
			);

			form.reset();
			await navigate('/otp', {
				state: { challenge, returnTo: location.state?.returnTo },
			});
		} catch (error) {
			const areCredentialsInvalid =
				error instanceof ClientError && error.code === HTTP_ERROR_CODE.CREDENTIALS_INVALID;

			setError((error as Error).message);
			setHasInvalidCredentials(areCredentialsInvalid);

			if (areCredentialsInvalid) {
				const emailInput = form.elements.namedItem('email');

				if (emailInput instanceof HTMLInputElement) {
					emailInput.focus();
				}
			}
		} finally {
			setIsBusy(false);
		}
	}

	return (
		<AuthPanel
			title={isSignup ? 'Create your account' : 'Sign in'}
			description="Continue with your email and password. We’ll email you a verification code next."
			footer={
				<p className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
					<span>{isSignup ? 'Already have an account?' : 'New to Self Review?'}</span>
					<Link
						className="inline-flex min-h-11 items-center rounded-button-quiet text-foreground underline md:min-h-10"
						to={isSignup ? '/login' : '/register'}
						state={location.state}
					>
						{isSignup ? 'Sign in' : 'Create account'}
					</Link>
				</p>
			}
		>
			<form className="space-y-6" onSubmit={(event) => void submit(event)} aria-busy={isBusy}>
				<div className="space-y-4">
					<div className="grid gap-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							name="email"
							type="email"
							autoComplete="email"
							autoCapitalize="none"
							spellCheck={false}
							required
							maxLength={254}
							aria-invalid={Boolean(fieldErrors.email || hasInvalidCredentials)}
							aria-describedby={
								[
									fieldErrors.email && 'email-error',
									hasInvalidCredentials && 'login-error',
								]
									.filter(Boolean)
									.join(' ') || undefined
							}
							onChange={() => clearFieldError('email')}
							onInvalid={(event) =>
								setFieldError('email', event.currentTarget.validationMessage)
							}
						/>
						{fieldErrors.email && (
							<p
								id="email-error"
								role="alert"
								className="flex items-start gap-2 text-ui wrap-anywhere text-error"
							>
								<CircleX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
								{fieldErrors.email}
							</p>
						)}
					</div>
					<div className="grid gap-2">
						<Label htmlFor="password">Password</Label>
						<Input
							id="password"
							name="password"
							type="password"
							autoComplete={isSignup ? 'new-password' : 'current-password'}
							required
							minLength={12}
							maxLength={128}
							aria-invalid={Boolean(fieldErrors.password || hasInvalidCredentials)}
							aria-describedby={[
								'password-hint',
								fieldErrors.password && 'password-error',
								hasInvalidCredentials && 'login-error',
							]
								.filter(Boolean)
								.join(' ')}
							onChange={() => clearFieldError('password')}
							onInvalid={(event) =>
								setFieldError('password', event.currentTarget.validationMessage)
							}
						/>
						<span id="password-hint" className="text-ui text-muted-foreground">
							12–128 characters
						</span>
						{fieldErrors.password && (
							<p
								id="password-error"
								role="alert"
								className="flex items-start gap-2 text-ui wrap-anywhere text-error"
							>
								<CircleX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
								{fieldErrors.password}
							</p>
						)}
					</div>
				</div>
				{error && (
					<div id="login-error">
						<Status variant="error">{error}</Status>
					</div>
				)}
				<div className="space-y-3">
					<Button className="w-full" disabled={isBusy}>
						{isBusy ? 'Sending code…' : 'Send verification code'}
					</Button>
					<p className="text-ui text-muted-foreground">
						{isSignup
							? 'Your account is created after email verification.'
							: 'Full access follows email verification.'}
					</p>
				</div>
			</form>
		</AuthPanel>
	);
}
