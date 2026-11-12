type TCatalogPage = { items: { id: string }[]; nextCursor: string | null };

export function catalogContinuation(pages: TCatalogPage[], pageParams: unknown[]) {
	const last = pages.at(-1);
	if (!last?.nextCursor) {
		return { nextCursor: undefined, hasLoop: false };
	}
	const previousIds = new Set(
		pages.slice(0, -1).flatMap((page) => page.items.map((item) => item.id)),
	);
	const hasLoop =
		pageParams.includes(last.nextCursor) ||
		!last.items.some((item) => !previousIds.has(item.id));
	return { nextCursor: hasLoop ? undefined : last.nextCursor, hasLoop };
}
