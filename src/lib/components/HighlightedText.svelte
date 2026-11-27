<script lang="ts">
	import { highlightText, type HighlightPart } from '#lib/client/search-highlight.js';

	let {
		text = '',
		query = '',
		parts
	} = $props<{
		text?: string;
		query?: string;
		parts?: HighlightPart[];
	}>();
	let shown = $derived(parts ?? highlightText(text, query));
</script>

{#each shown as part, index (index)}{#if part.matched}<mark class="search-highlight">
			{part.text}
		</mark>{:else}{part.text}{/if}{/each}
