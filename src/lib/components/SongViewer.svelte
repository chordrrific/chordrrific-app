<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { preventChordOverlap } from '#lib/client/chord-layout.js';
	import { chorusMode, initChorusMode, setChorusMode } from '#lib/client/chorus-preference.js';
	import { generalToneOffset, generalViewerSettings } from '#lib/client/viewer-defaults.js';
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
	import Icon from './Icon.svelte';

	let { song, onPinChange } = $props<{
		song: Song;
		onPinChange: (patch: SongViewerPinUpdate) => Promise<boolean>;
	}>();
	let content = $derived(song.content);
	const viewerId = $props.id();
	let notation = $state<Notation>(generalViewerSettings.notation);
	let notationInitialized = $state(false);
	let semitones = $state(0);
	let toneInitialized = $state(false);
	let pinBusy = $state(false);
	let referenceModes = $state<{ content: string | null; modes: Record<number, ChorusMode> }>({
		content: null,
		modes: {}
	});
	let library = $state.raw<typeof import('chordsheetjs') | null>(null);
	let loadError = $state<string | null>(null);
	let openMenu = $state<'transpose' | 'chorus' | null>(null);
	const notationLabels = {
		symbol: 'letters',
		solfege: 'solfege',
		'special-solfege': 'specialSolfege',
		number: 'nashville',
		roman: 'roman'
	} as const;

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
					song.pinnedChorusMode ?? $chorusMode,
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

	async function toggleTonePin() {
		if (!originalKey || !currentKey) return;
		const unpinning = song.pinnedTone !== null;
		if (await savePin({ pinnedTone: unpinning ? null : currentKey.pitchClass })) {
			if (unpinning) semitones = generalToneOffset(originalKey);
		}
	}

	async function selectTone(offset: number) {
		if (pinBusy) return;
		const previous = semitones;
		semitones = offset;
		if (song.pinnedTone !== null && originalKey) {
			const target = transposeSongKey(originalKey, offset).pitchClass;
			if (!(await savePin({ pinnedTone: target }))) semitones = previous;
		}
	}

	async function commitSliderTone() {
		if (song.pinnedTone === null || !originalKey) return;
		const target = transposeSongKey(originalKey, semitones).pitchClass;
		if (!(await savePin({ pinnedTone: target }))) {
			semitones = offsetForTone(originalKey, song.pinnedTone);
		}
	}

	async function toggleNotationPin() {
		const unpinning = song.pinnedNotation !== null;
		if (await savePin({ pinnedNotation: unpinning ? null : notation })) {
			if (unpinning) notation = generalViewerSettings.notation;
		}
	}

	async function toggleChorusPin(mode: ChorusMode) {
		await savePin({ pinnedChorusMode: song.pinnedChorusMode === mode ? null : mode });
	}

	async function cycleNotation() {
		if (pinBusy) return;
		const previous = notation;
		const next = (viewerNotations.indexOf(notation) + 1) % viewerNotations.length;
		notation = viewerNotations[next];
		openMenu = null;
		if (song.pinnedNotation !== null && !(await savePin({ pinnedNotation: notation }))) {
			notation = previous;
		}
	}

	async function chooseChorusMode(mode: ChorusMode) {
		referenceModes = { content, modes: {} };
		openMenu = null;
		if (song.pinnedChorusMode !== null) await savePin({ pinnedChorusMode: mode });
		else setChorusMode(mode);
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
	{#if (hasChords && originalKey && currentKey) || hasChorusReferences}
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
						<button
							type="button"
							class="viewer-pin-button"
							class:active={song.pinnedTone !== null}
							disabled={pinBusy}
							aria-label={`${t($locale, song.pinnedTone === null ? 'pinSetting' : 'unpinSetting')}: ${t($locale, 'transpose')}`}
							aria-pressed={song.pinnedTone !== null}
							onclick={toggleTonePin}
						>
							<Icon name="pin" size={13} />
						</button>
						{#if openMenu === 'transpose'}
							<div class="viewer-tone-popover" role="group" aria-label={t($locale, 'transpose')}>
								<div class="viewer-original-row">
									<button
										class="viewer-original-reset"
										type="button"
										disabled={pinBusy}
										onclick={() => selectTone(0)}
									>
										{t($locale, 'originalTone')} · {toneLabel(originalKey, notation)}
									</button>
									<button
										type="button"
										class="viewer-pin-button viewer-popover-pin"
										class:active={song.pinnedTone !== null}
										disabled={pinBusy}
										aria-label={`${t($locale, song.pinnedTone === null ? 'pinSetting' : 'unpinSetting')}: ${t($locale, 'transpose')}`}
										aria-pressed={song.pinnedTone !== null}
										onclick={toggleTonePin}
									>
										<Icon name="pin" size={15} />
									</button>
								</div>
								<input
									type="range"
									min="-5"
									max="6"
									step="1"
									bind:value={semitones}
									disabled={pinBusy}
									onchange={commitSliderTone}
									aria-label={t($locale, 'transpose')}
								/>
								<div class="viewer-tone-scale">
									{#each tones as tone (tone.offset)}
										<button
											type="button"
											class:original={tone.offset === 0}
											class:active={tone.offset === semitones}
											disabled={pinBusy}
											title={tone.label}
											aria-label={`${tone.label}${tone.offset === 0 ? ` (${t($locale, 'originalTone')})` : ''}`}
											onclick={() => selectTone(tone.offset)}
										>
											{tone.label}
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>
					<div class="viewer-notation-control viewer-menu-control">
						<button
							type="button"
							class="viewer-control-button viewer-notation-button"
							class:pinned={song.pinnedNotation !== null}
							disabled={pinBusy}
							aria-label={`${t($locale, 'notation')}: ${t($locale, notationLabels[notation])}`}
							title={`${t($locale, 'notation')}: ${t($locale, notationLabels[notation])}`}
							onclick={cycleNotation}
						>
							<Icon name="music" size={22} /><span class="viewer-key-badge">
								{toneLabel(originalKey, notation)}
							</span>
						</button>
						<button
							type="button"
							class="viewer-pin-button"
							class:active={song.pinnedNotation !== null}
							disabled={pinBusy}
							aria-label={`${t($locale, song.pinnedNotation === null ? 'pinSetting' : 'unpinSetting')}: ${t($locale, 'notation')}`}
							aria-pressed={song.pinnedNotation !== null}
							onclick={toggleNotationPin}
						>
							<Icon name="pin" size={13} />
						</button>
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
									<div class="viewer-chorus-option" role="none">
										<button
											type="button"
											role="menuitemradio"
											aria-checked={(song.pinnedChorusMode ?? $chorusMode) === mode}
											class:active={(song.pinnedChorusMode ?? $chorusMode) === mode}
											disabled={pinBusy}
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
											class="viewer-pin-button viewer-option-pin"
											class:active={song.pinnedChorusMode === mode}
											disabled={pinBusy}
											aria-label={`${t($locale, song.pinnedChorusMode === mode ? 'unpinSetting' : 'pinSetting')}: ${t($locale, mode === 'label' ? 'chorusOptionLabel' : mode === 'expanded' ? 'chorusExpanded' : 'chorusHidden')}`}
											aria-pressed={song.pinnedChorusMode === mode}
											onclick={() => toggleChorusPin(mode)}
										>
											<Icon name="pin" size={14} />
										</button>
									</div>
								{/each}
							</div>{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}
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
