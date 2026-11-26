<script lang="ts">
	import { onMount } from 'svelte';
	import { request } from '#lib/client/api.js';
	import {
		changedMembershipIds,
		collectionSongIds,
		moved,
		movedTo,
		withSongOrder
	} from '#lib/client/catalog.js';
	import { catalogRevision } from '#lib/client/catalog-state.js';
	import {
		createSongSearch,
		cycleFacet,
		libraryFacets,
		retainAvailableFacets,
		selectFacet,
		soleCollectionFilter,
		soleDisplayFilter,
		visibleLibrarySongs,
		type FacetKey,
		type FacetSelection
	} from '#lib/client/library.js';
	import { locale, t } from '#lib/client/i18n.js';
	import { formatChordPro, insertDirective } from '#lib/client/chordpro-language.js';
	import { notify, notifyTransient } from '#lib/client/notifications.js';
	import { confirmAction } from '#lib/client/confirmation.js';
	import { keyboardShortcuts } from '#lib/client/keyboard-shortcuts.js';
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
	let modifierHeld = $state(false);
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
	let reordering = $state(false);
	let pendingOrder = $state<{ collectionId: string; ids: string[] } | null>(null);
	let drag = $state<{
		pointerId: number;
		songId: string;
		targetId: string | null;
		collectionId: string;
		ids: string[];
	} | null>(null);
	let scrollElement: HTMLDivElement;
	let dragPointer: { x: number; y: number } | null = null;
	let scrollFrame: number | null = null;
	let touchStart: { x: number; y: number } | null = null;
	let gestureStart: { x: number; y: number } | null = null;
	const newSongDraft = insertDirective('title');
	function focusOnMount(node: HTMLElement) {
		node.focus();
	}

	let facets = $derived(libraryFacets(songs));
	let searchIndex = $derived(createSongSearch(songs));
	let singleFilter = $derived(soleDisplayFilter(filters, search));
	let singleCollection = $derived(soleCollectionFilter(filters, search, collections));
	let singleFilterLabel = $derived(
		singleFilter
			? `${singleFilter.mode === 'exclude' ? '− ' : ''}${singleFilter.value ?? t($locale, singleFilter.key)}`
			: ''
	);
	let visibleSongs = $derived(
		visibleLibrarySongs(songs, filters, search, collections, searchIndex)
	);
	let displayedSongs = $derived.by(() => {
		if (!pendingOrder || pendingOrder.collectionId !== singleCollection?.id) return visibleSongs;
		const byId = new Map(visibleSongs.map((song) => [song.id, song]));
		const ordered = pendingOrder.ids.flatMap((id) => {
			const song = byId.get(id);
			return song ? [song] : [];
		});
		return ordered.length === visibleSongs.length ? ordered : visibleSongs;
	});
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
			const [loadedSongs, loadedCollections] = await Promise.all([
				request<Song[]>('/api/songs'),
				request<Collection[]>('/api/collections')
			]);
			songs = loadedSongs;
			collections = loadedCollections;
			if (filters.length) filters = retainAvailableFacets(filters, libraryFacets(loadedSongs));
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
		const unsubscribe = catalogRevision.subscribe(() => void loadCatalog());
		return () => {
			unsubscribe();
			cancelDrag();
		};
	});

	function chooseFacet(key: FacetKey, value: string | undefined, additive: boolean) {
		filters = additive ? cycleFacet(filters, key, value, true) : selectFacet(key, value);
		selectedIds = [];
		if (!additive && window.innerWidth <= 800) sidebarOpen = false;
	}
	function filterFromCard(key: FacetKey, value: string) {
		filters = [{ key, value, mode: 'include' }];
		search = '';
		selectedIds = [];
		sidebarOpen = false;
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
		if (event.target instanceof Element && event.target.closest('.song-drag-handle')) return;
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
		content = newSongDraft.text;
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
		if (event.ctrlKey || event.metaKey) modifierHeld = true;
		if (event.key === 'Escape') {
			if (drag) {
				cancelDrag();
				return;
			}
			if (pendingExit) {
				if (!busy) pendingExit = null;
			} else if (pendingSongId) {
				if (!busy) pendingSongId = null;
			} else if (membershipKind) membershipKind = null;
			else if (modalOpen) requestLeaveEditor(modalMode === 'edit' && !creating ? 'view' : 'close');
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
	function keyup(event: KeyboardEvent) {
		modifierHeld = event.ctrlKey || event.metaKey;
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
	function dragTargetAt(x: number, y: number): string | null {
		const element = document.elementFromPoint(x, y);
		if (!(element instanceof Element) || !scrollElement?.contains(element)) return null;
		return element.closest<HTMLElement>('[data-song-id]')?.dataset.songId ?? null;
	}
	function updateDragTarget(x: number, y: number) {
		if (!drag) return;
		const targetId = dragTargetAt(x, y);
		if (targetId !== drag.targetId) drag = { ...drag, targetId };
	}
	function autoScrollDrag() {
		if (!drag || !dragPointer || !scrollElement) return;
		const rect = scrollElement.getBoundingClientRect();
		const { x, y } = dragPointer;
		const edge = 48;
		const speed =
			y >= rect.top && y < rect.top + edge
				? -10
				: y <= rect.bottom && y > rect.bottom - edge
					? 10
					: 0;
		if (speed && x >= rect.left && x <= rect.right) {
			scrollElement.scrollTop += speed;
			updateDragTarget(x, y);
		}
		scrollFrame = requestAnimationFrame(autoScrollDrag);
	}
	function cancelDrag() {
		if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
		scrollFrame = null;
		dragPointer = null;
		drag = null;
	}
	function startDrag(event: PointerEvent, songId: string) {
		if ((event.pointerType === 'mouse' && event.button !== 0) || !singleCollection || reordering)
			return;
		const ids = collectionSongIds(singleCollection);
		if (ids.length < 2) return;
		event.preventDefault();
		(event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId);
		dragPointer = { x: event.clientX, y: event.clientY };
		drag = {
			pointerId: event.pointerId,
			songId,
			targetId: null,
			collectionId: singleCollection.id,
			ids
		};
		scrollFrame = requestAnimationFrame(autoScrollDrag);
	}
	function moveDrag(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.pointerId) return;
		dragPointer = { x: event.clientX, y: event.clientY };
		updateDragTarget(event.clientX, event.clientY);
	}
	function endDrag(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.pointerId) return;
		const active = drag;
		const targetId = dragTargetAt(event.clientX, event.clientY);
		cancelDrag();
		if (!targetId || singleCollection?.id !== active.collectionId) return;
		void saveCollectionOrder(active.collectionId, movedTo(active.ids, active.songId, targetId));
	}
	function keyReorder(songId: string, delta: number) {
		if (!singleCollection || reordering) return;
		const ids = collectionSongIds(singleCollection);
		const next = moved(ids, ids.indexOf(songId), delta);
		if (next !== ids) void saveCollectionOrder(singleCollection.id, next);
	}
	async function saveCollectionOrder(collectionId: string, ids: string[]) {
		const collection = collections.find((item) => item.id === collectionId);
		if (!collection || reordering || !withSongOrder(collection, ids)) return;
		const current = collectionSongIds(collection);
		if (ids.every((id, index) => id === current[index])) return;
		reordering = true;
		pendingOrder = { collectionId, ids };
		try {
			await request(`/api/collections/${collectionId}/songs`, 'PUT', { songIds: ids });
			const latest = collections.find((item) => item.id === collectionId);
			const reordered = latest && withSongOrder(latest, ids);
			if (reordered)
				collections = collections.map((item) => (item.id === collectionId ? reordered : item));
			else await loadCatalog();
		} catch (cause) {
			void notify(
				'error',
				t($locale, 'error'),
				cause instanceof Error ? cause.message : String(cause)
			);
		} finally {
			pendingOrder = null;
			reordering = false;
		}
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
		if (event.ctrlKey || event.metaKey) return;
		if (event.key === ',' || event.key === 'Enter') {
			event.preventDefault();
			addMembershipName();
		}
	}
	async function saveMembership() {
		if (
			!membershipKind ||
			busy ||
			(membershipBulk && !membershipNames.length && !membershipInput.trim())
		)
			return;
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
	onpointermove={moveDrag}
	onpointerup={endDrag}
	onpointercancel={(event) => {
		if (drag?.pointerId === event.pointerId) cancelDrag();
	}}
	onkeydown={keydown}
	onkeyup={keyup}
	onblur={() => (modifierHeld = false)}
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
				disabled={!filters.length && !search}
				aria-label={`${t($locale, 'clearFilters')} ${t($locale, 'filters')}`}
				onclick={() => {
					filters = [];
					search = '';
				}}
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
					aria-label={t($locale, 'clearTextFilter')}
					title={t($locale, 'clearTextFilter')}
				>
					<Icon name="close" size={16} />
				</button>{/if}
		</div>
		<div class="filter-divider" aria-hidden="true"></div>
		<FacetSidebar
			{facets}
			active={filters}
			{modifierHeld}
			{pinned}
			{expanded}
			onChoose={chooseFacet}
			onPin={togglePin}
			onExpand={toggleExpanded}
		/>
	</aside>
	<section class="library-main">
		<div class="library-results-heading">
			<button
				class="icon-button mobile-only"
				onclick={() => (sidebarOpen = true)}
				aria-label={t($locale, 'filters')}
				title={t($locale, 'filters')}
			>
				<Icon name="menu" />
			</button>
			{#if singleFilter}
				<h1
					class="filter-value-heading"
					class:collection-chip={singleFilter.key === 'collection'}
					class:tag-chip={singleFilter.key === 'tag'}
					title={singleFilterLabel}
				>
					<span>{singleFilterLabel}</span>
				</h1>
				<span class="muted">{visibleSongs.length}</span>
			{:else}
				<h1>{t($locale, 'songs')}</h1>
				<span class="muted">
					{visibleSongs.length}{#if filters.length || search.trim()}&nbsp;({t(
							$locale,
							'filteredCount'
						)}){/if}
				</span>
			{/if}
			<button
				class="primary new-song-button"
				onclick={newSong}
				aria-label={t($locale, 'newSong')}
				title={t($locale, 'newSong')}
			>
				<Icon name="plus" size={20} />
			</button>
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
		<div class="song-results-scroll" bind:this={scrollElement}>
			{#if visibleSongs.length}<div class="song-grid">
					{#each displayedSongs as song (song.id)}<SongCard
							{song}
							selected={selectedIds.includes(song.id)}
							reorderable={singleCollection !== null}
							reorderDisabled={reordering || visibleSongs.length < 2}
							dragging={drag?.songId === song.id}
							dropTarget={drag?.targetId === song.id && drag?.songId !== song.id}
							onReorderStart={(event) => startDrag(event, song.id)}
							onReorderKey={(delta) => keyReorder(song.id, delta)}
							onOpen={(event) => cardOpen(song, event)}
							onSelect={() => toggleSongSelection(song.id)}
							onEdit={() => openSong(song, 'edit')}
							onDelete={() => deleteSongs([song.id])}
							onTags={() => openMembership('tag', [song.id])}
							onCollections={() => openMembership('collection', [song.id])}
							onFilter={filterFromCard}
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
			{#if modalMode === 'edit'}<form
					onsubmit={saveSong}
					class="song-edit-form"
					use:keyboardShortcuts={{
						onCancel: () => requestLeaveEditor(creating ? 'close' : 'view')
					}}
				>
					<div class="editor-label">{t($locale, 'content')}</div>
					<ChordProEditor
						value={content}
						label={t($locale, 'content')}
						initialCursor={creating ? newSongDraft.cursor : undefined}
						autoFocus={creating}
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
		tabindex="-1"
		use:focusOnMount
		use:keyboardShortcuts={{
			onSave: () => void saveMembership(),
			onCancel: () => (membershipKind = null)
		}}
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
		use:keyboardShortcuts={{
			onSave: () => void saveAndNavigate(),
			onCancel: () => (pendingSongId = null)
		}}
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
