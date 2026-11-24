import type { Action } from 'svelte/action';

interface ChordBounds {
	left: number;
	width: number;
}

export function chordOffsets(bounds: ChordBounds[], gap: number): number[] {
	let previousRight = Number.NEGATIVE_INFINITY;
	return bounds.map(({ left, width }) => {
		const adjustedLeft = Math.max(left, previousRight + gap);
		previousRight = adjustedLeft + width;
		return adjustedLeft - left;
	});
}

export const preventChordOverlap: Action<HTMLDivElement> = (node) => {
	let frame: number | null = null;
	let destroyed = false;

	function layout() {
		for (const row of node.querySelectorAll<HTMLElement>('.chord-sheet .row')) {
			const labels = [...row.querySelectorAll<HTMLElement>('.column > .chord')].filter((label) =>
				label.textContent?.trim()
			);

			for (const label of labels) label.style.transform = '';
			const bounds = labels.map((label) => {
				const { left, width } = label.getBoundingClientRect();
				return { left, width };
			});
			const offsets = chordOffsets(bounds, 4);
			labels.forEach((label, index) => {
				if (offsets[index] > 0) label.style.transform = `translateX(${offsets[index]}px)`;
			});
		}
	}

	function schedule() {
		if (frame !== null) return;
		frame = requestAnimationFrame(() => {
			frame = null;
			layout();
		});
	}

	layout();
	const mutationObserver = new MutationObserver(schedule);
	mutationObserver.observe(node, { childList: true, subtree: true, characterData: true });
	const resizeObserver = new ResizeObserver(schedule);
	resizeObserver.observe(node);
	void document.fonts.ready.then(() => {
		if (!destroyed) schedule();
	});

	return {
		destroy() {
			destroyed = true;
			mutationObserver.disconnect();
			resizeObserver.disconnect();
			if (frame !== null) cancelAnimationFrame(frame);
		}
	};
};
