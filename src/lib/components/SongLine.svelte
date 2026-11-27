<script lang="ts">
	import type { PreviewLine, PreviewSegment } from '#lib/client/song-preview.js';
	import { highlightSegmentedText } from '#lib/client/search-highlight.js';
	import HighlightedText from './HighlightedText.svelte';

	let { line, query = '' } = $props<{ line: PreviewLine; query?: string }>();
	let lyricsParts = $derived(
		highlightSegmentedText(
			line.segments.map((segment: PreviewSegment) => segment.lyrics),
			query
		)
	);
</script>

<div class="row" class:has-chords={line.hasChords} class:comment={line.comment}>
	{#each line.segments as segment, segmentIndex (segmentIndex)}
		<div class="column">
			{#if segment.chord}<div class="chord">{segment.chord}</div>{/if}
			<div class="lyrics"><HighlightedText parts={lyricsParts[segmentIndex]} /></div>
		</div>
	{/each}
</div>
