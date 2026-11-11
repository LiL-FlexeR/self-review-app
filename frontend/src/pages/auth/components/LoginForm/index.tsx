import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Challenge, Credentials } from '@self-review/contracts';
import { auth } from '@app/auth/session';
import { Button } from '@app/components/ui/Button';
import { Input } from '@app/components/ui/Input';
import { Status } from '@app/components/ui/Status';
import { Label } from '@app/components/ui/Label';
import { AuthPanel } from '@app/components/templates/AuthPanel';

export function LoginForm() {
	const loc = useLocation();
	const navigate = useNavigate();
	const signup = loc.pathname === '/register';
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError('');

		const form = event.currentTarget;
		const values = Object.fromEntries(new FormData(form));
		const parsedCredentials = Credentials.safeParse(values);

		if (!parsedCredentials.success) {
			setError('Enter a valid email and a password of 12–128 characters.');

			return;
		}

		setBusy(true);

		try {
			const challenge = Challenge.parse(
				await auth.raw(signup ? '/auth/signup' : '/auth/login', {
					method: 'POST',
					body: JSON.stringify(parsedCredentials.data),
				}),
			);

			form.reset();
			await navigate('/otp', {
				state: { challenge, returnTo: loc.state?.returnTo },
			});
		} catch (error) {
			setError((error as Error).message);
		} finally {
			setBusy(false);
		}
	}

	return (
		<AuthPanel
			title={signup ? 'Create your account' : 'Welcome back'}
			description="Your work, with evidence. Continue with your password and an emailed verification code."
		>
			<form className="grid gap-4" onSubmit={(event) => void submit(event)} aria-busy={busy}>
				<div className="grid gap-2">
					<Label htmlFor="email">Email</Label>
					<Input
						id="email"
						name="email"
						type="email"
						autoComplete="email"
						required
						maxLength={254}
					/>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="password">Password</Label>
					<Input
						id="password"
						name="password"
						type="password"
						autoComplete={signup ? 'new-password' : 'current-password'}
						required
						minLength={12}
						maxLength={128}
						aria-describedby="password-hint"
					/>
					<span id="password-hint" className="text-sm text-muted-foreground">
						12–128 characters
					</span>
				</div>
				<Button disabled={busy}>
					{busy ? 'Sending code…' : signup ? 'Create account' : 'Continue'}
				</Button>
			</form>
			{error && <Status>{error}</Status>}
			<p className="text-sm text-muted-foreground">
				{signup ? 'Already have an account?' : 'New here?'}{' '}
				<Link to={signup ? '/login' : '/register'} state={loc.state}>
					{signup ? 'Sign in' : 'Create account'}
				</Link>
			</p>
			<p className="text-sm text-muted-foreground">Full access follows email verification.</p>
		</AuthPanel>
	);
}
