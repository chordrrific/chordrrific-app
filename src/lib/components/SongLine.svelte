<script lang="ts">
	import type { PreviewLine } from '#lib/client/song-preview.js';

	let { line } = $props<{ line: PreviewLine }>();
</script>

<div class="row" class:has-chords={line.hasChords} class:comment={line.comment}>
	{#each line.segments as segment, segmentIndex (segmentIndex)}
		<div class="column">
			<div class="chord">{segment.chord}</div>
			<div class="lyrics">{segment.lyrics}</div>
		</div>
	{/each}
</div>
