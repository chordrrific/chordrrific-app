<script lang="ts">
	import { onMount } from 'svelte';
	import { request } from '#lib/client/api.js';
	import { changedMembershipIds } from '#lib/client/catalog.js';
	import { catalogRevision } from '#lib/client/catalog-state.js';
	import {
		cycleFacet,
		libraryFacets,
		visibleLibrarySongs,
		type FacetKey,
		type FacetSelection
	} from '#lib/client/library.js';
	import { locale, t } from '#lib/client/i18n.js';
	import { formatChordPro } from '#lib/client/chordpro-language.js';
	import { notify, notifyTransient } from '#lib/client/notifications.js';
	import { confirmAction } from '#lib/client/confirmation.js';
	import { songMetadata, replaceSongTags } from '#lib/core/song-metadata.js';
	import { hasTitleDirective, titleFromChordPro } from '#lib/core/song-title.js';
	import type { Collection, Song } from '#lib/client/types.js';
	import SongViewer from '#lib/components/SongViewer.svelte';
	import ChordProEditor from '#lib/components/ChordProEditor.svelte';
	import FacetSidebar from '#lib/components/FacetSidebar.svelte';
	import SongCard from '#lib/components/SongCard.svelte';
	import Icon from '#lib/components/Icon.svelte';

	let songs = $state<Song[]>([]);
	let collections = $state<Collection[]>([]);
	let search = $state('');
	let filters = $state<FacetSelection[]>([]);
	let pinned = $state<FacetKey[]>([]);
	let expanded = $state<FacetKey[]>([]);
	let sidebarOpen = $state(false);
	let selectedIds = $state<string[]>([]);
	let modalOpen = $state(false);
	let modalId = $state<string | null>(null);
	let creating = $state(false);
	let modalMode = $state<'view' | 'edit'>('view');
	let content = $state('');
	let savedContent = $state('');
	let pendingSongId = $state<string | null>(null);
	let pendingExit = $state<'close' | 'view' | null>(null);
	let membershipKind = $state<'tag' | 'collection' | null>(null);
	let membershipTargets = $state<string[]>([]);
	let membershipNames = $state<string[]>([]);
	let membershipInput = $state('');
	let membershipBulk = $state(false);
	let membershipOperation = $state<'add' | 'remove'>('add');
	let busy = $state(false);
	let touchStart: { x: number; y: number } | null = null;
	let gestureStart: { x: number; y: number } | null = null;
	function focusOnMount(node: HTMLElement) {
		node.focus();
	}

	let facets = $derived(libraryFacets(songs));
	let visibleSongs = $derived(visibleLibrarySongs(songs, filters, search, collections));
	let modalSong = $derived(songs.find((song) => song.id === modalId));
	let modalIndex = $derived(visibleSongs.findIndex((song) => song.id === modalId));
	let existingNames = $derived(
		membershipKind === 'tag'
			? [...new Set(songs.flatMap((song) => songMetadata(song.content).tag))].sort((a, b) =>
					a.localeCompare(b)
				)
			: collections.map((collection) => collection.name)
	);
	async function loadCatalog() {
		try {
			[songs, collections] = await Promise.all([
				request<Song[]>('/api/songs'),
				request<Collection[]>('/api/collections')
			]);
			selectedIds = selectedIds.filter((id) => songs.some((song) => song.id === id));
		} catch (cause) {
			void notify(
				'error',
				t($locale, 'error'),
				cause instanceof Error ? cause.message : String(cause)
			);
		}
	}
	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem('chordrrific-pinned-facets') ?? '[]');
			if (Array.isArray(saved))
				pinned = saved.filter((key): key is FacetKey => typeof key === 'string');
			expanded = [...pinned];
		} catch {
			pinned = [];
		}
		return catalogRevision.subscribe(() => void loadCatalog());
	});

	function chooseFacet(key: FacetKey, value: string | undefined, additive: boolean) {
		filters = cycleFacet(filters, key, value, additive);
		selectedIds = [];
		if (!additive && window.innerWidth <= 800) sidebarOpen = false;
	}
	function togglePin(key: FacetKey) {
		pinned = pinned.includes(key) ? pinned.filter((item) => item !== key) : [...pinned, key];
		if (pinned.includes(key) && !expanded.includes(key)) expanded = [...expanded, key];
		localStorage.setItem('chordrrific-pinned-facets', JSON.stringify(pinned));
	}
	function toggleExpanded(key: FacetKey) {
		expanded = expanded.includes(key)
			? expanded.filter((item) => item !== key)
			: [...expanded, key];
	}
	function touchBegin(event: TouchEvent) {
		if (window.innerWidth > 800 || modalOpen) return;
		const touch = event.touches[0];
		if (touch && (sidebarOpen || touch.clientX < 40))
			touchStart = { x: touch.clientX, y: touch.clientY };
	}
	function touchEnd(event: TouchEvent) {
		if (!touchStart || modalOpen) return;
		const touch = event.changedTouches[0];
		if (touch && Math.abs(touch.clientY - touchStart.y) < 65) {
			const distance = touch.clientX - touchStart.x;
			if (distance > 70) sidebarOpen = true;
			if (distance < -70) sidebarOpen = false;
		}
		touchStart = null;
	}
	function openSong(song: Song, mode: 'view' | 'edit' = 'view') {
		modalId = song.id;
		creating = false;
		modalMode = mode;
		content = song.content;
		savedContent = song.content;
		modalOpen = true;
		pendingSongId = null;
		pendingExit = null;
	}
	function newSong() {
		modalId = null;
		creating = true;
		modalMode = 'edit';
		content = '{title: }\n{key: C}\n\n[C]';
		savedContent = content;
		modalOpen = true;
		pendingSongId = null;
		pendingExit = null;
	}
	function forceCloseSong() {
		modalOpen = false;
		creating = false;
		content = '';
		savedContent = '';
		pendingSongId = null;
		pendingExit = null;
	}
	function finishLeavingEditor(action: 'close' | 'view') {
		pendingExit = null;
		content = savedContent;
		if (action === 'close') forceCloseSong();
		else modalMode = 'view';
	}
	function requestLeaveEditor(action: 'close' | 'view') {
		if (busy) return;
		if (modalMode === 'edit' && content !== savedContent) {
			pendingExit = action;
			return;
		}
		finishLeavingEditor(action);
	}
	function discardAndLeave() {
		if (pendingExit) finishLeavingEditor(pendingExit);
	}
	function switchMode() {
		if (modalMode === 'edit') {
			requestLeaveEditor(creating ? 'close' : 'view');
		} else {
			content = modalSong?.content ?? '';
			savedContent = content;
			modalMode = 'edit';
		}
	}
	function navigateSong(delta: number) {
		const song = visibleSongs[modalIndex + delta];
		if (!song) return;
		if (modalMode === 'edit' && content !== savedContent) {
			pendingSongId = song.id;
			return;
		}
		openSong(song, modalMode);
	}
	function gestureBegin(x: number, y: number, target: EventTarget | null) {
		if (creating || pendingSongId || pendingExit || !(target instanceof Element)) return;
		if (
			target.closest(
				'button, a, input, textarea, select, .chordpro-editor, [contenteditable="true"]'
			)
		)
			return;
		gestureStart = { x, y };
	}
	function gestureEnd(x: number, y: number) {
		if (!gestureStart) return;
		const dx = x - gestureStart.x;
		const dy = y - gestureStart.y;
		gestureStart = null;
		if (Math.abs(dx) >= 80 && Math.abs(dy) <= 65) navigateSong(dx > 0 ? -1 : 1);
	}
	function keydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (pendingExit) {
				if (!busy) pendingExit = null;
			} else if (pendingSongId) {
				if (!busy) pendingSongId = null;
			} else if (membershipKind) membershipKind = null;
			else if (modalOpen) requestLeaveEditor('close');
			else sidebarOpen = false;
			return;
		}
		if (!modalOpen || creating || pendingSongId || pendingExit || membershipKind) return;
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		if (
			event.target instanceof Element &&
			event.target.closest('input, textarea, select, .chordpro-editor, [contenteditable="true"]')
		)
			return;
		event.preventDefault();
		navigateSong(event.key === 'ArrowLeft' ? -1 : 1);
	}
	function beforeUnload(event: BeforeUnloadEvent) {
		if (modalOpen && modalMode === 'edit' && content !== savedContent) {
			event.preventDefault();
			event.returnValue = '';
		}
	}
	function cardOpen(song: Song, event: MouseEvent) {
		if (event.ctrlKey || event.metaKey) {
			toggleSongSelection(song.id);
			return;
		}
		openSong(song);
	}
	function toggleSongSelection(id: string) {
		selectedIds = selectedIds.includes(id)
			? selectedIds.filter((selectedId) => selectedId !== id)
			: [...selectedIds, id];
	}
	async function persistSong(): Promise<boolean> {
		busy = true;
		try {
			if (!hasTitleDirective(content)) throw new Error(t($locale, 'titleDirectiveRequired'));
			titleFromChordPro(content);
			const song = await request<Song>(
				creating ? '/api/songs' : `/api/songs/${modalId}`,
				creating ? 'POST' : 'PATCH',
				{ content }
			);
			await loadCatalog();
			modalId = song.id;
			creating = false;
			content = song.content;
			savedContent = song.content;
			notifyTransient('success', t($locale, 'saved'));
			return true;
		} catch (cause) {
			void notify(
				'error',
				t($locale, 'error'),
				cause instanceof Error ? cause.message : String(cause)
			);
			return false;
		} finally {
			busy = false;
		}
	}
	async function saveSong(event: SubmitEvent) {
		event.preventDefault();
		if (await persistSong()) modalMode = 'view';
	}
	async function saveAndNavigate() {
		const target = pendingSongId;
		if (!target || busy) return;
		if (!(await persistSong())) {
			pendingSongId = null;
			return;
		}
		const song = songs.find((item) => item.id === target);
		if (song) openSong(song, 'edit');
		else pendingSongId = null;
	}
	async function deleteSongs(ids: readonly string[]) {
		if (
			!ids.length ||
			!(await confirmAction(
				ids.length === 1 ? t($locale, 'confirmDelete') : t($locale, 'confirmBulkDelete'),
				{ destructive: true }
			))
		)
			return;
		busy = true;
		try {
			for (const id of ids) await request(`/api/songs/${id}`, 'DELETE');
			if (modalId && ids.includes(modalId)) forceCloseSong();
			selectedIds = [];
			await loadCatalog();
			void notify('success', t($locale, 'deleted'));
		} catch (cause) {
			void notify(
				'error',
				t($locale, 'error'),
				cause instanceof Error ? cause.message : String(cause)
			);
			await loadCatalog();
		} finally {
			busy = false;
		}
	}
	function openMembership(kind: 'tag' | 'collection', ids: string[], bulk = false) {
		membershipKind = kind;
		membershipTargets = ids;
		membershipBulk = bulk;
		membershipOperation = 'add';
		membershipInput = '';
		const song = songs.find((item) => item.id === ids[0]);
		membershipNames =
			bulk || !song
				? []
				: kind === 'tag'
					? songMetadata(song.content).tag
					: song.collections.map((link) => link.collection.name);
	}
	function addMembershipName(value = membershipInput) {
		for (const part of value.split(',')) {
			const name = part.trim();
			if (
				name &&
				!membershipNames.some((current) => current.toLocaleLowerCase() === name.toLocaleLowerCase())
			)
				membershipNames = [...membershipNames, name];
		}
		membershipInput = '';
	}
	function membershipKeydown(event: KeyboardEvent) {
		if (event.key === ',' || event.key === 'Enter') {
			event.preventDefault();
			addMembershipName();
		}
	}
	async function saveMembership() {
		if (!membershipKind) return;
		if (membershipInput.trim()) addMembershipName();
		busy = true;
		try {
			if (membershipKind === 'tag') {
				for (const id of membershipTargets) {
					const song = songs.find((item) => item.id === id);
					if (!song) continue;
					const current = songMetadata(song.content).tag;
					const names = membershipBulk
						? membershipOperation === 'add'
							? [...current, ...membershipNames]
							: current.filter(
									(name) =>
										!membershipNames.some(
											(chosen) => chosen.toLocaleLowerCase() === name.toLocaleLowerCase()
										)
								)
						: membershipNames;
					const updated = replaceSongTags(song.content, names);
					if (updated !== song.content)
						await request(`/api/songs/${id}`, 'PATCH', { content: updated });
				}
			} else {
				const nextCollections = [...collections];
				if (membershipOperation === 'add' || !membershipBulk) {
					for (const name of membershipNames) {
						if (
							!nextCollections.some(
								(item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase()
							)
						) {
							const created = await request<Pick<Collection, 'id' | 'name'>>(
								'/api/collections',
								'POST',
								{ name }
							);
							nextCollections.push({ ...created, songs: [] });
						}
					}
				}
				for (const collection of nextCollections) {
					const chosen = membershipNames.some(
						(name) => name.toLocaleLowerCase() === collection.name.toLocaleLowerCase()
					);
					if (membershipBulk && !chosen) continue;
					let ids = collection.songs.map((entry) => entry.songId);
					for (const id of membershipTargets) {
						const changed = changedMembershipIds(
							{
								...collection,
								songs: ids.map((songId, position) => ({
									songId,
									position,
									song: { id: songId, title: '' }
								}))
							},
							id,
							membershipBulk ? membershipOperation === 'add' : chosen
						);
						if (changed) ids = changed;
					}
					if (
						ids.length !== collection.songs.length ||
						ids.some((id, index) => id !== collection.songs[index]?.songId)
					)
						await request(`/api/collections/${collection.id}/songs`, 'PUT', { songIds: ids });
				}
			}
			membershipKind = null;
			selectedIds = [];
			await loadCatalog();
			notifyTransient('success', t($locale, 'saved'));
		} catch (cause) {
			void notify(
				'error',
				t($locale, 'error'),
				cause instanceof Error ? cause.message : String(cause)
			);
			await loadCatalog();
		} finally {
			busy = false;
		}
	}
</script>

<svelte:window
	ontouchstart={touchBegin}
	ontouchend={touchEnd}
	onkeydown={keydown}
	onbeforeunload={beforeUnload}
/>
<svelte:head><title>{t($locale, 'songs')} · Chordrrific</title></svelte:head>
<div class="library-shell">
	{#if sidebarOpen}<button
			class="sidebar-scrim"
			aria-label={t($locale, 'close')}
			onclick={() => (sidebarOpen = false)}
		></button>{/if}
	<aside class:open={sidebarOpen} class="library-sidebar" aria-label={t($locale, 'filters')}>
		<div class="sidebar-title">
			<h2>{t($locale, 'filters')}</h2>
			<button
				class="clear-filters"
				disabled={!filters.length}
				aria-label={`${t($locale, 'clearFilters')} ${t($locale, 'filters')}`}
				onclick={() => (filters = [])}
			>
				{t($locale, 'clearFilters')}
			</button>
			<button
				class="icon-button mobile-only"
				aria-label={t($locale, 'close')}
				onclick={() => (sidebarOpen = false)}
			>
				<Icon name="close" />
			</button>
		</div>
		<FacetSidebar
			{facets}
			active={filters}
			{pinned}
			{expanded}
			onChoose={chooseFacet}
			onPin={togglePin}
			onExpand={toggleExpanded}
		/>
	</aside>
	<section class="library-main">
		<div class="library-toolbar">
			<button
				class="icon-button mobile-only"
				onclick={() => (sidebarOpen = true)}
				aria-label={t($locale, 'filters')}
			>
				<Icon name="menu" />
			</button>
			<div class="search-field">
				<Icon name="search" size={18} /><input
					type="search"
					bind:value={search}
					aria-label={t($locale, 'search')}
					placeholder={t($locale, 'search')}
				/>
				{#if search}<button
						type="button"
						class="icon-button search-clear"
						onclick={() => (search = '')}
						aria-label={t($locale, 'clearTitleFilter')}
						title={t($locale, 'clearTitleFilter')}
					>
						<Icon name="close" size={16} />
					</button>{/if}
			</div>
			<button class="primary" onclick={newSong}>
				<Icon name="plus" size={18} />{t($locale, 'newSong')}
			</button>
		</div>
		<div class="library-results-heading">
			<h1>{t($locale, 'songs')}</h1>
			<span class="muted">
				{visibleSongs.length}{#if filters.length || search.trim()}&nbsp;({t(
						$locale,
						'filteredCount'
					)}){/if}
			</span>
		</div>
		{#if selectedIds.length}<div class="bulk-toolbar">
				<strong>{selectedIds.length} {t($locale, 'selectedCount')}</strong><button
					class="bulk-action"
					onclick={() => openMembership('tag', selectedIds, true)}
					aria-label={t($locale, 'tags')}
					title={t($locale, 'tags')}
				>
					<Icon name="tag" size={17} /><span class="bulk-action-label">{t($locale, 'tags')}</span>
				</button><button
					class="bulk-action"
					onclick={() => openMembership('collection', selectedIds, true)}
					aria-label={t($locale, 'collections')}
					title={t($locale, 'collections')}
				>
					<Icon name="folder" size={17} /><span class="bulk-action-label">
						{t($locale, 'collections')}
					</span>
				</button><button
					class="bulk-action danger"
					disabled={busy}
					onclick={() => deleteSongs(selectedIds)}
					aria-label={t($locale, 'delete')}
					title={t($locale, 'delete')}
				>
					<Icon name="trash" size={17} /><span class="bulk-action-label">
						{t($locale, 'delete')}
					</span>
				</button><button
					class="icon-button"
					onclick={() => (selectedIds = [])}
					aria-label={t($locale, 'cancel')}
					title={t($locale, 'cancel')}
				>
					<Icon name="close" size={17} />
				</button>
			</div>{/if}
		<div class="song-results-scroll">
			{#if visibleSongs.length}<div class="song-grid">
					{#each visibleSongs as song (song.id)}<SongCard
							{song}
							selected={selectedIds.includes(song.id)}
							onOpen={(event) => cardOpen(song, event)}
							onSelect={() => toggleSongSelection(song.id)}
							onEdit={() => openSong(song, 'edit')}
							onDelete={() => deleteSongs([song.id])}
							onTags={() => openMembership('tag', [song.id])}
							onCollections={() => openMembership('collection', [song.id])}
						/>{/each}
				</div>
			{:else}<p class="empty-library">
					{songs.length ? t($locale, 'noResults') : t($locale, 'noSongs')}
				</p>{/if}
		</div>
	</section>
</div>

{#if modalOpen}
	<div class="dialog-scrim"></div>
	<div
		class="song-dialog"
		role="dialog"
		tabindex="-1"
		use:focusOnMount
		aria-modal="true"
		aria-label={creating ? t($locale, 'newSong') : (modalSong?.title ?? t($locale, 'songs'))}
		ontouchstart={(event) => {
			const touch = event.touches[0];
			if (touch) gestureBegin(touch.clientX, touch.clientY, event.target);
		}}
		ontouchend={(event) => {
			const touch = event.changedTouches[0];
			if (touch) gestureEnd(touch.clientX, touch.clientY);
		}}
		onpointerdown={(event) => {
			if (event.pointerType === 'mouse' && event.button === 0)
				gestureBegin(event.clientX, event.clientY, event.target);
		}}
		onpointerup={(event) => {
			if (event.pointerType === 'mouse') gestureEnd(event.clientX, event.clientY);
		}}
	>
		<div class="song-dialog-header">
			<div class="song-dialog-title">
				<button
					class="icon-button"
					disabled={creating || modalIndex <= 0}
					onclick={() => navigateSong(-1)}
					aria-label={t($locale, 'previousSong')}
				>
					<Icon name="left" />
				</button><strong>{creating ? t($locale, 'newSong') : modalSong?.title}</strong><button
					class="icon-button"
					disabled={creating || modalIndex < 0 || modalIndex >= visibleSongs.length - 1}
					onclick={() => navigateSong(1)}
					aria-label={t($locale, 'nextSong')}
				>
					<Icon name="right" />
				</button>
			</div>
			<div class="actions">
				{#if !creating}<button
						class="icon-button"
						onclick={switchMode}
						aria-label={t($locale, modalMode === 'view' ? 'edit' : 'view')}
						title={t($locale, modalMode === 'view' ? 'edit' : 'view')}
					>
						<Icon name={modalMode === 'view' ? 'edit' : 'eye'} />
					</button>{/if}<button
					class="icon-button"
					onclick={() => requestLeaveEditor('close')}
					aria-label={t($locale, 'close')}
				>
					<Icon name="close" />
				</button>
			</div>
		</div>
		<div class="song-dialog-body">
			{#if modalMode === 'edit'}<form onsubmit={saveSong} class="song-edit-form">
					<div class="editor-label">{t($locale, 'content')}</div>
					<ChordProEditor
						value={content}
						label={t($locale, 'content')}
						onChange={(value) => (content = value)}
					/>
					<div class="actions">
						<button type="button" onclick={() => (content = formatChordPro(content))}>
							{t($locale, 'formatSong')}
						</button><button class="primary" disabled={busy}>{t($locale, 'save')}</button><button
							type="button"
							onclick={() => requestLeaveEditor(creating ? 'close' : 'view')}
						>
							{t($locale, 'cancel')}
						</button>
					</div>
				</form>
			{:else if modalSong}<SongViewer content={modalSong.content} />{/if}
		</div>
	</div>
{/if}

{#if membershipKind}
	<div class="dialog-scrim top"></div>
	<div
		class="membership-dialog"
		role="dialog"
		aria-modal="true"
		aria-label={t($locale, membershipKind === 'tag' ? 'editTags' : 'editCollections')}
	>
		<div class="membership-header">
			<h2>{t($locale, membershipKind === 'tag' ? 'editTags' : 'editCollections')}</h2>
			<button
				class="icon-button"
				onclick={() => (membershipKind = null)}
				aria-label={t($locale, 'close')}
			>
				<Icon name="close" />
			</button>
		</div>
		{#if membershipBulk}<div class="membership-mode">
				<button
					class:active={membershipOperation === 'add'}
					onclick={() => (membershipOperation = 'add')}
				>
					{t($locale, 'bulkAdd')}
				</button><button
					class:active={membershipOperation === 'remove'}
					onclick={() => (membershipOperation = 'remove')}
				>
					{t($locale, 'bulkRemove')}
				</button>
			</div>{/if}
		<label>
			{t($locale, 'name')}<input
				bind:value={membershipInput}
				list="membership-options"
				placeholder={t($locale, membershipKind === 'tag' ? 'addTagHint' : 'addCollectionHint')}
				onkeydown={membershipKeydown}
			/>
		</label>
		<datalist id="membership-options">
			{#each existingNames as name (name)}<option value={name}></option>{/each}
		</datalist>
		<div class="membership-chips">
			{#each membershipNames as name (name)}<span class="tag-chip">
					{name}<button
						class="chip-remove"
						onclick={() => (membershipNames = membershipNames.filter((item) => item !== name))}
						aria-label={`${t($locale, 'remove')} ${name}`}
					>
						<Icon name="close" size={14} />
					</button>
				</span>{/each}
		</div>
		<div class="actions membership-actions">
			<button onclick={() => (membershipKind = null)}>{t($locale, 'cancel')}</button><button
				class="primary"
				disabled={busy || (membershipBulk && !membershipNames.length && !membershipInput.trim())}
				onclick={saveMembership}
			>
				{t($locale, 'save')}
			</button>
		</div>
	</div>
{/if}

{#if pendingSongId}
	<div class="dialog-scrim top"></div>
	<div
		class="unsaved-dialog"
		role="alertdialog"
		tabindex="-1"
		use:focusOnMount
		aria-modal="true"
		aria-label={t($locale, 'unsavedNavigation')}
	>
		<p>{t($locale, 'unsavedNavigation')}</p>
		<div class="actions">
			<button type="button" disabled={busy} onclick={() => (pendingSongId = null)}>
				{t($locale, 'stayEditing')}
			</button><button type="button" class="primary" disabled={busy} onclick={saveAndNavigate}>
				{t($locale, 'saveAndNavigate')}
			</button>
		</div>
	</div>
{/if}

{#if pendingExit}
	<div class="dialog-scrim top"></div>
	<div
		class="unsaved-dialog"
		role="alertdialog"
		tabindex="-1"
		use:focusOnMount
		aria-modal="true"
		aria-label={t($locale, 'unsavedDiscard')}
	>
		<p>{t($locale, 'unsavedDiscard')}</p>
		<div class="actions">
			<button type="button" onclick={() => (pendingExit = null)}>
				{t($locale, 'continueEditing')}
			</button>
			<button type="button" class="danger" onclick={discardAndLeave}>
				{t($locale, 'discardChanges')}
			</button>
		</div>
	</div>
{/if}
