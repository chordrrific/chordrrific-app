<script lang="ts">
	import { onMount } from 'svelte';
	import { locale, t } from '#lib/client/i18n.js';

	let { content } = $props<{ content: string }>();
	let notation = $state<'symbol' | 'solfege' | 'number'>('symbol');
	let semitones = $state(0);
	let ready = $state(false);
	let library = $state.raw<typeof import('chordsheetjs') | null>(null);
	let purifier = $state.raw<typeof import('dompurify').default | null>(null);

	onMount(async () => {
		library = await import('chordsheetjs');
		purifier = (await import('dompurify')).default;
		ready = true;
	});

	let hasKey = $derived(
		ready && library ? Boolean(new library.ChordProParser().parse(content).key) : false
	);
	let markup = $derived.by(() => {
		if (!ready || !library || !purifier) return '';
		try {
			const song = new library.ChordProParser().parse(content).transpose(semitones);
			song.metadata.set('chord_style', notation === 'number' && !song.key ? 'symbol' : notation);
			return purifier.sanitize(new library.HtmlTableFormatter().format(song));
		} catch {
			return '';
		}
	});
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
{#if !hasKey}<p class="muted">{t($locale, 'keyNeeded')}</p>{/if}
<div class="viewer" aria-label={t($locale, 'preview')}>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{#if ready}{@html markup}{:else}<p>{t($locale, 'loading')}</p>{/if}
</div>
