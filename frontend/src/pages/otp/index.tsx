import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Challenge } from '@self-review/contracts';
import { auth } from '@app/auth/session';
import { OtpForm } from '@app/components/templates/OtpForm';

export function OtpPage() {
	const location = useLocation();
	const navigate = useNavigate();
	const challenge = Challenge.safeParse(location.state?.challenge);

	if (!challenge.success) {
		return <Navigate to="/login" replace />;
	}

	async function verify(challengeId: string, code: string) {
		await auth.verify(challengeId, code);

		const destination = location.state?.returnTo;

		await navigate(
			typeof destination === 'string' && /^\/(connections|projects)(\/|$)/.test(destination)
				? destination
				: '/connections',
			{ replace: true },
		);
	}

	async function resend(challengeId: string) {
		return Challenge.parse(
			await auth.raw('/auth/resend-otp', {
				method: 'POST',
				body: JSON.stringify({ challengeId }),
			}),
		);
	}

	return (
		<OtpForm
			key={challenge.data.challengeId}
			initialChallenge={challenge.data}
			onVerify={verify}
			onResend={resend}
			restartAction={
				<Link
					className="inline-flex min-h-11 items-center self-start rounded-button-quiet py-2 text-ui underline md:min-h-10"
					to="/login"
					state={{ returnTo: location.state?.returnTo }}
				>
					Start again with email and password
				</Link>
			}
		/>
	);
}
