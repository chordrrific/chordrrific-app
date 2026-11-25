<script lang="ts">
	import { onMount } from 'svelte';
	import { request } from '#lib/client/api.js';
	import { changedMembershipIds } from '#lib/client/catalog.js';
	import {
		cycleFacet,
		libraryFacets,
		visibleLibrarySongs,
		type FacetKey,
		type FacetSelection
	} from '#lib/client/library.js';
	import { locale, t } from '#lib/client/i18n.js';
	import { formatChordPro } from '#lib/client/chordpro-language.js';
	import { songMetadata, replaceSongTags } from '#lib/core/song-metadata.js';
	import { hasTitleDirective, titleFromChordPro } from '#lib/core/song-title.js';
	import {
		chordProFileAccept,
		importChordProFiles,
		type SongImportResult
	} from '#lib/client/song-import.js';
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
	let membershipKind = $state<'tag' | 'collection' | null>(null);
	let membershipTargets = $state<string[]>([]);
	let membershipNames = $state<string[]>([]);
	let membershipInput = $state('');
	let membershipBulk = $state(false);
	let membershipOperation = $state<'add' | 'remove'>('add');
	let message = $state('');
	let busy = $state(false);
	let importing = $state(false);
	let importResults = $state<SongImportResult[]>([]);
	let fileInput: HTMLInputElement;
	let touchStart: { x: number; y: number } | null = null;

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
	let importedCount = $derived(
		importResults.filter((result) => result.status === 'imported').length
	);
	let failedCount = $derived(importResults.length - importedCount);

	async function loadCatalog() {
		try {
			[songs, collections] = await Promise.all([
				request<Song[]>('/api/songs'),
				request<Collection[]>('/api/collections')
			]);
			selectedIds = selectedIds.filter((id) => songs.some((song) => song.id === id));
		} catch (cause) {
			message = cause instanceof Error ? cause.message : String(cause);
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
		void loadCatalog();
	});

	function chooseFacet(key: FacetKey, value: string | undefined, additive: boolean) {
		filters = cycleFacet(filters, key, value, additive);
		selectedIds = [];
		if (window.innerWidth <= 800) sidebarOpen = false;
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
		if (window.innerWidth > 800) return;
		const touch = event.touches[0];
		if (touch && (sidebarOpen || touch.clientX < 40))
			touchStart = { x: touch.clientX, y: touch.clientY };
	}
	function touchEnd(event: TouchEvent) {
		if (!touchStart) return;
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
		modalOpen = true;
		message = '';
	}
	function newSong() {
		modalId = null;
		creating = true;
		modalMode = 'edit';
		content = '{title: }\n{key: C}\n\n[C]';
		modalOpen = true;
		message = '';
	}
	function closeSong() {
		modalOpen = false;
		creating = false;
		content = '';
		message = '';
	}
	function switchMode() {
		if (modalMode === 'edit') {
			if (creating) {
				closeSong();
				return;
			}
			content = modalSong?.content ?? '';
			modalMode = 'view';
		} else {
			content = modalSong?.content ?? '';
			modalMode = 'edit';
		}
		message = '';
	}
	function navigateSong(delta: number) {
		const song = visibleSongs[modalIndex + delta];
		if (song) openSong(song, modalMode);
	}
	function cardOpen(song: Song, event: MouseEvent) {
		if (event.ctrlKey || event.metaKey) {
			selectedIds = selectedIds.includes(song.id)
				? selectedIds.filter((id) => id !== song.id)
				: [...selectedIds, song.id];
			return;
		}
		openSong(song);
	}
	async function importSelected(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = '';
		if (!files.length) return;
		importing = true;
		importResults = [];
		try {
			importResults = await importChordProFiles(files, (song) =>
				request<Song>('/api/songs', 'POST', song)
			);
			if (importResults.some((result) => result.status === 'imported')) await loadCatalog();
		} finally {
			importing = false;
		}
	}
	async function saveSong(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		message = '';
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
			modalMode = 'view';
			message = t($locale, 'saved');
		} catch (cause) {
			message = cause instanceof Error ? cause.message : String(cause);
		} finally {
			busy = false;
		}
	}
	async function deleteSongs(ids: readonly string[]) {
		if (
			!ids.length ||
			!confirm(ids.length === 1 ? t($locale, 'confirmDelete') : t($locale, 'confirmBulkDelete'))
		)
			return;
		busy = true;
		message = '';
		try {
			for (const id of ids) await request(`/api/songs/${id}`, 'DELETE');
			if (modalId && ids.includes(modalId)) closeSong();
			selectedIds = [];
			await loadCatalog();
		} catch (cause) {
			message = cause instanceof Error ? cause.message : String(cause);
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
		message = '';
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
		message = '';
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
			message = t($locale, 'saved');
		} catch (cause) {
			message = cause instanceof Error ? cause.message : String(cause);
			await loadCatalog();
		} finally {
			busy = false;
		}
	}
</script>

<svelte:window
	ontouchstart={touchBegin}
	ontouchend={touchEnd}
	onkeydown={(event) => {
		if (event.key === 'Escape') {
			if (membershipKind) membershipKind = null;
			else if (modalOpen) closeSong();
			else sidebarOpen = false;
		}
	}}
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
				class="icon-button mobile-only"
				aria-label={t($locale, 'close')}
				onclick={() => (sidebarOpen = false)}
			>
				<Icon name="close" />
			</button>
		</div>
		{#if filters.length}<button class="clear-filters" onclick={() => (filters = [])}>
				{t($locale, 'clearFilters')}
			</button>{/if}
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
			</div>
			<button class="primary" onclick={newSong}>
				<Icon name="plus" size={18} />{t($locale, 'newSong')}
			</button>
			<button disabled={importing} onclick={() => fileInput.click()}>
				<Icon name="upload" size={18} />{t($locale, importing ? 'importingSongs' : 'importSongs')}
			</button>
			<input
				bind:this={fileInput}
				type="file"
				accept={chordProFileAccept}
				multiple
				hidden
				aria-label={t($locale, 'importSongs')}
				onchange={importSelected}
			/>
		</div>
		{#if importResults.length}<section class="card import-results" aria-live="polite">
				<h2>{t($locale, 'importSummary')}</h2>
				<p>
					{t($locale, 'importedCount')}: {importedCount} · {t($locale, 'failedCount')}: {failedCount}
				</p>
				<ul>
					{#each importResults as result, index (index)}<li>
							{result.fileName}: {result.status === 'imported' ? result.title : result.error}
						</li>{/each}
				</ul>
			</section>{/if}
		<div class="library-results-heading">
			<h1>{t($locale, 'songs')}</h1>
			<span class="muted">{visibleSongs.length} {t($locale, 'songCount')}</span>
		</div>
		{#if selectedIds.length}<div class="bulk-toolbar">
				<strong>{selectedIds.length} {t($locale, 'selectedCount')}</strong><button
					onclick={() => openMembership('tag', selectedIds, true)}
				>
					<Icon name="tag" size={17} />{t($locale, 'tags')}
				</button><button onclick={() => openMembership('collection', selectedIds, true)}>
					<Icon name="folder" size={17} />{t($locale, 'collections')}
				</button><button class="danger" disabled={busy} onclick={() => deleteSongs(selectedIds)}>
					<Icon name="trash" size={17} />{t($locale, 'delete')}
				</button><button
					class="icon-button"
					onclick={() => (selectedIds = [])}
					aria-label={t($locale, 'cancel')}
				>
					<Icon name="close" size={17} />
				</button>
			</div>{/if}
		{#if visibleSongs.length}<div class="song-grid">
				{#each visibleSongs as song (song.id)}<SongCard
						{song}
						selected={selectedIds.includes(song.id)}
						onOpen={(event) => cardOpen(song, event)}
						onEdit={() => openSong(song, 'edit')}
						onDelete={() => deleteSongs([song.id])}
						onTags={() => openMembership('tag', [song.id])}
						onCollections={() => openMembership('collection', [song.id])}
					/>{/each}
			</div>
		{:else}<p class="empty-library">
				{songs.length ? t($locale, 'noResults') : t($locale, 'noSongs')}
			</p>{/if}
		{#if message && !modalOpen && !membershipKind}<p class="error" role="status">{message}</p>{/if}
	</section>
</div>

{#if modalOpen}
	<div class="dialog-scrim"></div>
	<div
		class="song-dialog"
		role="dialog"
		aria-modal="true"
		aria-label={creating ? t($locale, 'newSong') : (modalSong?.title ?? t($locale, 'songs'))}
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
					onclick={closeSong}
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
							onclick={creating ? closeSong : switchMode}
						>
							{t($locale, 'cancel')}
						</button>
					</div>
				</form>
			{:else if modalSong}<SongViewer content={modalSong.content} />{/if}
			{#if message}<p class={message === t($locale, 'saved') ? 'success' : 'error'} role="status">
					{message}
				</p>{/if}
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
		{#if message}<p class="error" role="status">{message}</p>{/if}
	</div>
{/if}
