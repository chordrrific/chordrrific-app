<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import { preventChordOverlap } from '#lib/client/chord-layout.js';
	import { chorusMode, initChorusMode } from '#lib/client/chorus-preference.js';
	import { generalToneOffset, generalViewerSettings } from '#lib/client/viewer-defaults.js';
	import {
		initViewerZoom,
		setViewerZoom,
		viewerZoom,
		zoomLevels
	} from '#lib/client/viewer-zoom.js';
	import { locale, t } from '#lib/client/i18n.js';
	import type { Song } from '#lib/client/types.js';
	import {
		chorusModes,
		viewerNotations,
		type SongViewerPinUpdate
	} from '#lib/core/viewer-preferences.js';
	import {
		defaultBisDisplayConfig,
		renderSongPreview,
		type ChorusMode,
		type Notation,
		type PreviewPart
	} from '#lib/client/song-preview.js';
	import {
		chromaticTones,
		offsetForTone,
		toneLabel,
		transposeSongKey
	} from '#lib/client/viewer-music.js';
	import SongLine from './SongLine.svelte';
	import HighlightedText from './HighlightedText.svelte';
	import Icon from './Icon.svelte';

	let {
		song,
		onPinChange,
		query = ''
	} = $props<{
		song: Song;
		onPinChange: (patch: SongViewerPinUpdate) => Promise<boolean>;
		query?: string;
	}>();
	let content = $derived(song.content);
	const viewerId = $props.id();
	let notation = $state<Notation>(generalViewerSettings.notation);
	let notationInitialized = $state(false);
	let chorusDisplay = $state<ChorusMode>('label');
	let semitones = $state(0);
	let toneInitialized = $state(false);
	let pinBusy = $state(false);
	let referenceModes = $state<{ content: string | null; modes: Record<number, ChorusMode> }>({
		content: null,
		modes: {}
	});
	let library = $state.raw<typeof import('chordsheetjs') | null>(null);
	let loadError = $state<string | null>(null);
	let openMenu = $state<'transpose' | 'notation' | 'chorus' | 'zoom' | null>(null);
	const notationLabels = {
		symbol: 'letters',
		solfege: 'solfege',
		'special-solfege': 'specialSolfege',
		number: 'nashville',
		roman: 'roman',
		hidden: 'hiddenNotation'
	} as const;

	onMount(() => {
		initChorusMode();
		initViewerZoom();
		chorusDisplay = song.pinnedChorusMode ?? get(chorusMode);
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
					chorusDisplay,
					defaultBisDisplayConfig,
					activeReferenceModes
				)
			: null
	);
	let hasChords = $derived(preview?.hasChords ?? false);
	let hasChorusReferences = $derived(preview?.hasChorusReferences ?? false);
	let originalKey = $derived(preview?.originalKey ?? null);
	let currentKey = $derived(preview?.currentKey ?? null);
	let tones = $derived(originalKey ? chromaticTones(originalKey, notation) : []);
	function isTonePinned(offset: number): boolean {
		return (
			originalKey !== null && song.pinnedTone === transposeSongKey(originalKey, offset).pitchClass
		);
	}
	$effect(() => {
		if (!notationInitialized) {
			notation = song.pinnedNotation ?? generalViewerSettings.notation;
			notationInitialized = true;
		}
	});

	$effect(() => {
		if (!toneInitialized && originalKey) {
			semitones =
				song.pinnedTone === null
					? generalToneOffset(originalKey)
					: offsetForTone(originalKey, song.pinnedTone);
			toneInitialized = true;
		}
	});

	async function savePin(patch: SongViewerPinUpdate): Promise<boolean> {
		if (pinBusy) return false;
		pinBusy = true;
		try {
			const saved = await onPinChange(patch);
			await tick();
			return saved;
		} finally {
			pinBusy = false;
		}
	}

	async function toggleTonePin(offset: number) {
		if (!originalKey) return;
		const target = transposeSongKey(originalKey, offset).pitchClass;
		const unpinning = song.pinnedTone === target;
		const previous = semitones;
		if (!unpinning) semitones = offset;
		if (!(await savePin({ pinnedTone: unpinning ? null : target })) && semitones === offset) {
			semitones = previous;
		}
	}

	async function toggleNotationPin(mode: Notation) {
		const unpinning = song.pinnedNotation === mode;
		const previous = notation;
		if (!unpinning) notation = mode;
		if (!(await savePin({ pinnedNotation: unpinning ? null : mode })) && notation === mode) {
			notation = previous;
		}
	}

	async function toggleChorusPin(mode: ChorusMode) {
		const unpinning = song.pinnedChorusMode === mode;
		const previous = chorusDisplay;
		if (!unpinning) chorusDisplay = mode;
		if (!(await savePin({ pinnedChorusMode: unpinning ? null : mode })) && chorusDisplay === mode) {
			chorusDisplay = previous;
		}
	}

	function chooseNotation(mode: Notation) {
		notation = mode;
		openMenu = null;
	}

	function chooseChorusMode(mode: ChorusMode) {
		referenceModes = { content, modes: {} };
		chorusDisplay = mode;
		openMenu = null;
	}
	function closeMenuOutside(event: PointerEvent) {
		if (
			openMenu &&
			event.target instanceof Element &&
			!event.target.closest('.viewer-menu-control')
		)
			openMenu = null;
	}
	function closeMenuOnEscape(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		event.stopPropagation();
		openMenu = null;
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

<svelte:window
	onpointerdown={closeMenuOutside}
	onkeydown={openMenu ? closeMenuOnEscape : undefined}
/>

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
		<a href={`#${viewerId}-chorus-${targetSourceIndex}`}>
			<HighlightedText text={t($locale, 'chorusLabel')} {query} />
		</a>
	</div>
{/snippet}

{#snippet renderPart(part: PreviewPart)}
	{#if part.kind === 'line'}
		<SongLine line={part} {query} />
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
				{#if part.label !== null}<span class="bis-label">
						<HighlightedText text={part.label} {query} />
					</span>{/if}
			</div>
		</div>
	{/if}
{/snippet}

<div class="song-viewer">
	<div class="viewer-controls">
		<div class="toolbar">
			{#if hasChords && originalKey && currentKey}
				<div class="viewer-menu-control viewer-transpose-control">
					<button
						type="button"
						class="viewer-control-button viewer-tone-button"
						class:pinned={song.pinnedTone !== null}
						aria-label={`${t($locale, 'transpose')}: ${toneLabel(currentKey, notation)}`}
						title={t($locale, 'transpose')}
						aria-expanded={openMenu === 'transpose'}
						onclick={() => (openMenu = openMenu === 'transpose' ? null : 'transpose')}
					>
						<Icon name="tuning-fork" size={22} /><span class="viewer-key-badge">
							{toneLabel(currentKey, notation)}
						</span>
					</button>
					{#if openMenu === 'transpose'}
						<div class="viewer-tone-popover" role="group" aria-label={t($locale, 'transpose')}>
							<button class="viewer-original-reset" type="button" onclick={() => (semitones = 0)}>
								{t($locale, 'originalTone')} · {toneLabel(originalKey, notation)}
							</button>
							<div class="viewer-tone-track">
								<input
									type="range"
									min="-5"
									max="6"
									step="1"
									bind:value={semitones}
									aria-label={t($locale, 'transpose')}
								/>
								<div class="viewer-tone-scale">
									{#each tones as tone (tone.offset)}
										<div class="viewer-tone-option">
											<button
												type="button"
												class="viewer-tone-value"
												class:original={tone.offset === 0}
												class:active={tone.offset === semitones}
												title={tone.label}
												aria-label={`${tone.label}${tone.offset === 0 ? ` (${t($locale, 'originalTone')})` : ''}`}
												onclick={() => (semitones = tone.offset)}
											>
												{tone.label}
											</button>
											<button
												type="button"
												class="viewer-tone-pin"
												class:active={isTonePinned(tone.offset)}
												disabled={pinBusy}
												aria-label={`${t($locale, isTonePinned(tone.offset) ? 'unpinSetting' : 'pinSetting')}: ${tone.label}`}
												aria-pressed={isTonePinned(tone.offset)}
												onclick={() => toggleTonePin(tone.offset)}
											>
												<Icon name="pin" size={13} />
											</button>
										</div>
									{/each}
								</div>
							</div>
						</div>
					{/if}
				</div>
				<div class="viewer-notation-control viewer-menu-control">
					<button
						type="button"
						class="viewer-control-button viewer-notation-button"
						class:pinned={song.pinnedNotation !== null}
						aria-label={`${t($locale, 'notation')}: ${t($locale, notationLabels[notation])}`}
						title={`${t($locale, 'notation')}: ${t($locale, notationLabels[notation])}`}
						aria-expanded={openMenu === 'notation'}
						onclick={() => (openMenu = openMenu === 'notation' ? null : 'notation')}
					>
						<Icon name="music" size={22} /><span class="viewer-key-badge">
							{toneLabel(originalKey, notation)}
						</span>
					</button>
					{#if openMenu === 'notation'}
						<div
							class="viewer-control-menu"
							role="menu"
							tabindex="-1"
							aria-label={t($locale, 'notation')}
						>
							{#each viewerNotations as mode (mode)}
								<div class="viewer-option-row" role="none">
									<button
										type="button"
										role="menuitemradio"
										aria-checked={notation === mode}
										class:active={notation === mode}
										onclick={() => chooseNotation(mode)}
									>
										{t($locale, notationLabels[mode])}
									</button>
									<button
										type="button"
										class="viewer-option-pin"
										class:active={song.pinnedNotation === mode}
										role="menuitemcheckbox"
										aria-checked={song.pinnedNotation === mode}
										disabled={pinBusy}
										aria-label={`${t($locale, song.pinnedNotation === mode ? 'unpinSetting' : 'pinSetting')}: ${t($locale, notationLabels[mode])}`}
										onclick={() => toggleNotationPin(mode)}
									>
										<Icon name="pin" size={14} />
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
			{#if hasChorusReferences}
				<div class="viewer-menu-control viewer-chorus-control">
					<button
						type="button"
						class="viewer-control-button"
						class:pinned={song.pinnedChorusMode !== null}
						aria-label={t($locale, 'chorusDisplay')}
						title={t($locale, 'chorusDisplay')}
						aria-expanded={openMenu === 'chorus'}
						onclick={() => (openMenu = openMenu === 'chorus' ? null : 'chorus')}
					>
						<Icon name="chorus" size={20} />
					</button>
					{#if openMenu === 'chorus'}<div
							class="viewer-control-menu"
							role="menu"
							tabindex="-1"
							aria-label={t($locale, 'chorusDisplay')}
						>
							{#each chorusModes as mode (mode)}
								<div class="viewer-option-row" role="none">
									<button
										type="button"
										role="menuitemradio"
										aria-checked={chorusDisplay === mode}
										class:active={chorusDisplay === mode}
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
									<button
										type="button"
										class="viewer-option-pin"
										class:active={song.pinnedChorusMode === mode}
										role="menuitemcheckbox"
										aria-checked={song.pinnedChorusMode === mode}
										disabled={pinBusy}
										aria-label={`${t($locale, song.pinnedChorusMode === mode ? 'unpinSetting' : 'pinSetting')}: ${t($locale, mode === 'label' ? 'chorusOptionLabel' : mode === 'expanded' ? 'chorusExpanded' : 'chorusHidden')}`}
										onclick={() => toggleChorusPin(mode)}
									>
										<Icon name="pin" size={14} />
									</button>
								</div>
							{/each}
						</div>{/if}
				</div>
			{/if}
			<div class="viewer-menu-control viewer-zoom-control">
				<button
					type="button"
					class="viewer-control-button"
					aria-label={`${t($locale, 'zoom')}: ${$viewerZoom}%`}
					title={`${t($locale, 'zoom')}: ${$viewerZoom}%`}
					aria-expanded={openMenu === 'zoom'}
					onclick={() => (openMenu = openMenu === 'zoom' ? null : 'zoom')}
				>
					<Icon name="search" size={20} />
				</button>
				{#if openMenu === 'zoom'}
					<div class="viewer-zoom-popover" role="group" aria-label={t($locale, 'zoom')}>
						<button class="viewer-original-reset" type="button" onclick={() => setViewerZoom(100)}>
							{t($locale, 'originalZoom')} · 100%
						</button>
						<input
							type="range"
							min="0"
							max={zoomLevels.length - 1}
							step="1"
							value={zoomLevels.indexOf($viewerZoom)}
							aria-label={t($locale, 'zoom')}
							aria-valuetext={`${$viewerZoom}%`}
							oninput={(event) => setViewerZoom(zoomLevels[Number(event.currentTarget.value)])}
						/>
						<div class="viewer-zoom-scale">
							{#each zoomLevels as level (level)}
								<button
									type="button"
									class:original={level === 100}
									class:active={$viewerZoom === level}
									aria-pressed={$viewerZoom === level}
									onclick={() => setViewerZoom(level)}
								>
									{level}%
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
	<div class="viewer" aria-label={t($locale, 'preview')} use:preventChordOverlap={$viewerZoom}>
		{#if loadError}<p class="error" role="alert">{t($locale, 'previewError')}: {loadError}</p>
		{:else if preview?.error}<p class="error" role="alert">
				{t($locale, 'previewError')}: {preview.error}
			</p>
		{:else if preview}
			<div class="chord-sheet" style={`--viewer-zoom: ${$viewerZoom / 100}`}>
				{#if preview.title}<h1 class="title">
						<HighlightedText text={preview.title} {query} />
					</h1>{/if}
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
						<div class="song-comment"><HighlightedText text={block.text} {query} /></div>
					{/if}
				{/each}
			</div>
		{:else}<p>{t($locale, 'loading')}</p>{/if}
	</div>
</div>
