import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { PageHeader } from '@app/components/templates/PageHeader';

it('provides one escaped page heading and a named action group', () => {
	const markup = renderToStaticMarkup(
		createElement(PageHeader, {
			title: 'Synthetic <project>',
			description: 'Saved evidence for the selected source.',
			actions: createElement('button', { type: 'button' }, 'Inspect evidence'),
		}),
	);

	expect(markup.match(/<h1\b/g)).toHaveLength(1);
	expect(markup).toContain('Synthetic &lt;project&gt;');
	expect(markup).toContain('role="group" aria-label="Page actions"');
	expect(markup).toContain('Inspect evidence');
	expect(markup).not.toContain('<project>');
});
