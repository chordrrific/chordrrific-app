<script lang="ts">
	import { onMount } from 'svelte';
	import type { ChordProEditorController } from '#lib/client/chordpro-codemirror.js';

	let { value, onChange, label } = $props<{
		value: string;
		onChange: (value: string) => void;
		label: string;
	}>();
	let host: HTMLDivElement;
	let controller: ChordProEditorController | null = null;
	let loadError = $state(false);

	onMount(() => {
		let active = true;
		void import('#lib/client/chordpro-codemirror.js')
			.then(({ createChordProEditor }) => {
				if (active) controller = createChordProEditor(host, value, onChange, label);
			})
			.catch(() => {
				loadError = true;
			});
		return () => {
			active = false;
			controller?.destroy();
		};
	});

	$effect(() => {
		controller?.setValue(value);
		controller?.setLabel(label);
	});
</script>

<div class="chordpro-editor" bind:this={host}></div>
{#if loadError}
	<textarea
		{value}
		oninput={(event) => onChange(event.currentTarget.value)}
		spellcheck="false"
		aria-label={label}></textarea>
{/if}
