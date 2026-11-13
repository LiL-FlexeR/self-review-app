import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Status } from '@app/components/ui/Status';

describe('Status accessibility', () => {
	it.each(['info', 'loading', 'success', 'warning'] as const)(
		'announces %s feedback politely with a non-color label',
		(variant) => {
			const markup = renderToStaticMarkup(
				createElement(Status, { variant, children: 'Saved source feedback' }),
			);

			expect(markup).toContain('role="status"');
			expect(markup).toContain('aria-live="polite"');
			expect(markup).toContain('class="sr-only"');
			expect(markup).toContain('aria-hidden="true"');
			expect(markup).toContain('Saved source feedback');
		},
	);

	it('announces blocking errors assertively without interpreting source text as HTML', () => {
		const markup = renderToStaticMarkup(
			createElement(Status, { variant: 'error', children: '<script>untrusted</script>' }),
		);

		expect(markup).toContain('role="alert"');
		expect(markup).toContain('aria-live="assertive"');
		expect(markup).toContain('Error:');
		expect(markup).toContain('&lt;script&gt;untrusted&lt;/script&gt;');
		expect(markup).not.toContain('<script>');
	});
});
