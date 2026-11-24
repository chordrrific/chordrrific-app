<script lang="ts">
	import { onMount } from 'svelte';
	import { preventChordOverlap } from '#lib/client/chord-layout.js';
	import { locale, t } from '#lib/client/i18n.js';
	import { renderSongPreview, type Notation } from '#lib/client/song-preview.js';

	let { content } = $props<{ content: string }>();
	let notation = $state<Notation>('symbol');
	let semitones = $state(0);
	let library = $state.raw<typeof import('chordsheetjs') | null>(null);
	let purifier = $state.raw<typeof import('dompurify').default | null>(null);
	let loadError = $state<string | null>(null);

	onMount(() => {
		void Promise.all([import('chordsheetjs'), import('dompurify')])
			.then(([chordSheet, domPurify]) => {
				library = chordSheet;
				purifier = domPurify.default;
			})
			.catch((cause: unknown) => {
				loadError = cause instanceof Error ? cause.message : String(cause);
			});
	});

	let preview = $derived(library ? renderSongPreview(library, content, notation, semitones) : null);
	let hasKey = $derived(preview?.hasKey ?? false);
</script>

<div class="toolbar">
	<label>
		{t($locale, 'transpose')}
		<div class="actions">
			<button onclick={() => (semitones -= 1)} aria-label="Down one semitone">−</button><span>
				{semitones > 0 ? '+' : ''}{semitones}
			</span><button onclick={() => (semitones += 1)} aria-label="Up one semitone">+</button>
		</div>
	</label>
	<label>
		{t($locale, 'notation')}
		<select bind:value={notation}>
			<option value="symbol">{t($locale, 'letters')}</option>
			<option value="solfege">{t($locale, 'solfege')}</option>
			<option value="number" disabled={!hasKey}>{t($locale, 'nashville')}</option>
		</select>
	</label>
</div>
{#if preview && !preview.error && !hasKey}<p class="muted">{t($locale, 'keyNeeded')}</p>{/if}
<div class="viewer" aria-label={t($locale, 'preview')} use:preventChordOverlap>
	{#if loadError}<p class="error" role="alert">{t($locale, 'previewError')}: {loadError}</p>
	{:else if preview?.error}<p class="error" role="alert">
			{t($locale, 'previewError')}: {preview.error}
		</p>
	{:else if preview && purifier}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html purifier.sanitize(preview.markup)}
	{:else}<p>{t($locale, 'loading')}</p>{/if}
</div>
