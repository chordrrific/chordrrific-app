<script lang="ts">
	import { onMount } from 'svelte';
	import { preventChordOverlap } from '#lib/client/chord-layout.js';
	import { chorusMode, initChorusMode, setChorusMode } from '#lib/client/chorus-preference.js';
	import { locale, t } from '#lib/client/i18n.js';
	import {
		defaultBisDisplayConfig,
		renderSongPreview,
		type ChorusMode,
		type Notation,
		type PreviewPart
	} from '#lib/client/song-preview.js';
	import SongLine from './SongLine.svelte';
	import Icon from './Icon.svelte';

	let { content } = $props<{ content: string }>();
	const viewerId = $props.id();
	let notation = $state<Notation>('symbol');
	let semitones = $state(0);
	let referenceModes = $state<{ content: string | null; modes: Record<number, ChorusMode> }>({
		content: null,
		modes: {}
	});
	let library = $state.raw<typeof import('chordsheetjs') | null>(null);
	let loadError = $state<string | null>(null);
	let chorusMenuOpen = $state(false);
	const chorusModes: readonly ChorusMode[] = ['label', 'expanded', 'hidden'];

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

	let activeReferenceModes = $derived(
		referenceModes.content === content ? referenceModes.modes : {}
	);
	let preview = $derived(
		library
			? renderSongPreview(
					library,
					content,
					notation,
					semitones,
					$chorusMode,
					defaultBisDisplayConfig,
					activeReferenceModes
				)
			: null
	);
	let hasKey = $derived(preview?.hasKey ?? false);
	let hasChords = $derived(preview?.hasChords ?? false);

	function chooseChorusMode(mode: ChorusMode) {
		referenceModes = { content, modes: {} };
		setChorusMode(mode);
		chorusMenuOpen = false;
	}
	function closeMenuOutside(event: PointerEvent) {
		if (
			chorusMenuOpen &&
			event.target instanceof Element &&
			!event.target.closest('.viewer-chorus-control')
		)
			chorusMenuOpen = false;
	}
	function closeMenuOnEscape(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		event.stopPropagation();
		chorusMenuOpen = false;
	}

	function toggleReference(sourceIndex: number, expanded: boolean) {
		referenceModes = {
			content,
			modes: {
				...activeReferenceModes,
				[sourceIndex]: expanded ? 'label' : 'expanded'
			}
		};
	}
</script>

<svelte:window onpointerdown={closeMenuOutside} />

{#snippet chorusReference(sourceIndex: number, targetSourceIndex: number, expanded: boolean)}
	<div class="chorus-reference" class:expanded>
		<button
			type="button"
			class="chorus-toggle"
			aria-label={t($locale, expanded ? 'collapseChorus' : 'expandChorus')}
			aria-expanded={expanded}
			onclick={() => toggleReference(sourceIndex, expanded)}
		>
			<svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
				<path d="m7 4 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
			</svg>
		</button>
		<a href={`#${viewerId}-chorus-${targetSourceIndex}`}>{t($locale, 'chorusLabel')}</a>
	</div>
{/snippet}

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

<div class="song-viewer">
	<div class="viewer-controls">
		<div class="toolbar">
			{#if hasChords}<label>
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
				</label>{/if}
			<div class="viewer-chorus-control">
				<button
					type="button"
					class="viewer-control-button"
					aria-label={t($locale, 'chorusDisplay')}
					title={t($locale, 'chorusDisplay')}
					aria-expanded={chorusMenuOpen}
					onclick={() => (chorusMenuOpen = !chorusMenuOpen)}
					onkeydown={chorusMenuOpen ? closeMenuOnEscape : undefined}
				>
					<Icon name="chorus" size={20} />
				</button>
				{#if chorusMenuOpen}<div
						class="viewer-control-menu"
						role="menu"
						tabindex="-1"
						aria-label={t($locale, 'chorusDisplay')}
						onkeydown={closeMenuOnEscape}
					>
						{#each chorusModes as mode (mode)}
							<button
								type="button"
								role="menuitemradio"
								aria-checked={$chorusMode === mode}
								class:active={$chorusMode === mode}
								onclick={() => chooseChorusMode(mode)}
							>
								{t(
									$locale,
									mode === 'label'
										? 'chorusOptionLabel'
										: mode === 'expanded'
											? 'chorusExpanded'
											: 'chorusHidden'
								)}
							</button>
						{/each}
					</div>{/if}
			</div>
		</div>
	</div>
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
						{#if block.recalled && block.targetSourceIndex !== undefined}
							{@render chorusReference(block.sourceIndex, block.targetSourceIndex, true)}
						{/if}
						<div
							id={block.section === 'chorus' && !block.recalled
								? `${viewerId}-chorus-${block.sourceIndex}`
								: undefined}
							class="paragraph"
							class:chorus={block.section === 'chorus'}
							class:recalled={block.recalled}
						>
							{#each block.parts as part, partIndex (partIndex)}
								{@render renderPart(part)}
							{/each}
						</div>
					{:else if block.kind === 'chorus-label'}
						{@render chorusReference(block.sourceIndex, block.targetSourceIndex, false)}
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
</div>
