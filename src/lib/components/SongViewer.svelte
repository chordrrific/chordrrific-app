<script lang="ts">
	import { onMount } from 'svelte';
	import { preventChordOverlap } from '#lib/client/chord-layout.js';
	import { chorusMode, initChorusMode, setChorusMode } from '#lib/client/chorus-preference.js';
	import { locale, t } from '#lib/client/i18n.js';
	import { renderSongPreview, type Notation, type PreviewPart } from '#lib/client/song-preview.js';
	import SongLine from './SongLine.svelte';

	let { content } = $props<{ content: string }>();
	let notation = $state<Notation>('symbol');
	let semitones = $state(0);
	let library = $state.raw<typeof import('chordsheetjs') | null>(null);
	let loadError = $state<string | null>(null);

	onMount(() => {
		initChorusMode();
		void import('chordsheetjs')
			.then((chordSheet) => {
				library = chordSheet;
			})
			.catch((cause: unknown) => {
				loadError = cause instanceof Error ? cause.message : String(cause);
			});
	});

	let preview = $derived(
		library ? renderSongPreview(library, content, notation, semitones, $chorusMode) : null
	);
	let hasKey = $derived(preview?.hasKey ?? false);
</script>

{#snippet renderPart(part: PreviewPart)}
	{#if part.kind === 'line'}
		<SongLine line={part} />
	{:else}
		<div class="bis-group">
			<div class="bis-content">
				{#each part.parts as child, childIndex (childIndex)}
					{@render renderPart(child)}
				{/each}
			</div>
			<div class="bis-bracket" aria-hidden="true"></div>
			<div class="bis-annotation">
				<span class="bis-marker">{part.marker}</span>
				{#if part.label !== null}<span class="bis-label">{part.label}</span>{/if}
			</div>
		</div>
	{/if}
{/snippet}

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
	<label>
		{t($locale, 'chorusDisplay')}
		<select
			value={$chorusMode}
			onchange={(event) =>
				setChorusMode(event.currentTarget.value === 'expanded' ? 'expanded' : 'label')}
		>
			<option value="label">{t($locale, 'chorusLabel')}</option>
			<option value="expanded">{t($locale, 'chorusExpanded')}</option>
		</select>
	</label>
</div>
{#if preview && !preview.error && !hasKey}<p class="muted">{t($locale, 'keyNeeded')}</p>{/if}
<div class="viewer" aria-label={t($locale, 'preview')} use:preventChordOverlap>
	{#if loadError}<p class="error" role="alert">{t($locale, 'previewError')}: {loadError}</p>
	{:else if preview?.error}<p class="error" role="alert">
			{t($locale, 'previewError')}: {preview.error}
		</p>
	{:else if preview}
		<div class="chord-sheet">
			{#if preview.title}<h1 class="title">{preview.title}</h1>{/if}
			{#each preview.blocks as block, blockIndex (blockIndex)}
				{#if block.kind === 'section'}
					<div
						class="paragraph"
						class:chorus={block.section === 'chorus'}
						class:recalled={block.recalled}
					>
						{#each block.parts as part, partIndex (partIndex)}
							{@render renderPart(part)}
						{/each}
					</div>
				{:else if block.kind === 'chorus-label'}
					<div class="chorus-reference">{t($locale, 'chorusLabel')}</div>
				{:else if block.kind === 'missing-chorus'}
					<div class="error" role="status">
						{t($locale, 'chorusMissing')}{block.label ? `: ${block.label}` : ''}
					</div>
				{:else if block.kind === 'comment'}
					<div class="song-comment">{block.text}</div>
				{/if}
			{/each}
		</div>
	{:else}<p>{t($locale, 'loading')}</p>{/if}
</div>
