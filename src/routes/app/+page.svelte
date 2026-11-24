<script lang="ts">
	import { onMount } from 'svelte';
	import { request } from '#lib/client/api.js';
	import { filterSongs, changedMembershipIds } from '#lib/client/catalog.js';
	import { locale, t } from '#lib/client/i18n.js';
	import type { Collection, Song, Tag } from '#lib/client/types.js';
	import SongViewer from '#lib/components/SongViewer.svelte';

	let songs = $state<Song[]>([]);
	let collections = $state<Collection[]>([]);
	let tags = $state<Tag[]>([]);
	let selectedId = $state<string | null>(null);
	let editing = $state(false);
	let title = $state('');
	let content = $state('');
	let search = $state('');
	let tagFilter = $state('');
	let collectionFilter = $state('');
	let chosenTags = $state<string[]>([]);
	let chosenCollections = $state<string[]>([]);
	let message = $state('');
	let busy = $state(false);
	let selected = $derived(songs.find((song) => song.id === selectedId));
	let visibleSongs = $derived(filterSongs(songs, search, tagFilter, collectionFilter));

	async function loadCatalog() {
		try {
			[songs, collections, tags] = await Promise.all([
				request<Song[]>('/api/songs'),
				request<Collection[]>('/api/collections'),
				request<Tag[]>('/api/tags')
			]);
		} catch (cause) {
			message = cause instanceof Error ? cause.message : String(cause);
		}
	}
	onMount(() => {
		void loadCatalog();
	});

	function selectSong(song: Song) {
		selectedId = song.id;
		title = song.title;
		content = song.content;
		chosenTags = song.tags.map((link) => link.tagId);
		chosenCollections = song.collections.map((link) => link.collectionId);
		editing = false;
		message = '';
	}
	function newSong() {
		selectedId = null;
		title = '';
		content = '{key: C}\n\n[C]';
		chosenTags = [];
		chosenCollections = [];
		editing = true;
		message = '';
	}
	function toggle(id: string, list: string[]): string[] {
		return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
	}
	async function saveSong(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		message = '';
		try {
			const song = await request<Song>(
				selectedId ? `/api/songs/${selectedId}` : '/api/songs',
				selectedId ? 'PATCH' : 'POST',
				{ title, content }
			);
			selectedId = song.id;
			editing = false;
			await loadCatalog();
			message = t($locale, 'saved');
		} catch (cause) {
			message = cause instanceof Error ? cause.message : String(cause);
		} finally {
			busy = false;
		}
	}
	async function deleteSelected() {
		if (!selectedId || !confirm(t($locale, 'confirmDelete'))) return;
		try {
			await request(`/api/songs/${selectedId}`, 'DELETE');
			selectedId = null;
			await loadCatalog();
		} catch (cause) {
			message = cause instanceof Error ? cause.message : String(cause);
		}
	}
	async function saveAssignments() {
		if (!selectedId) return;
		busy = true;
		message = '';
		try {
			await request(`/api/songs/${selectedId}/tags`, 'PUT', { tagIds: chosenTags });
			for (const collection of collections) {
				const ids = changedMembershipIds(
					collection,
					selectedId,
					chosenCollections.includes(collection.id)
				);
				if (ids) await request(`/api/collections/${collection.id}/songs`, 'PUT', { songIds: ids });
			}
			await loadCatalog();
			message = t($locale, 'saved');
		} catch (cause) {
			message = cause instanceof Error ? cause.message : String(cause);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>{t($locale, 'songs')} · Chordrrific</title></svelte:head>
<div class="toolbar">
	<label>{t($locale, 'search')}<input bind:value={search} type="search" /></label>
	<label>
		{t($locale, 'collections')}<select bind:value={collectionFilter}>
			<option value="">
				{t($locale, 'allCollections')}
			</option>{#each collections as collection (collection.id)}<option value={collection.id}>
					{collection.name}
				</option>{/each}
		</select>
	</label>
	<label>
		{t($locale, 'tags')}<select bind:value={tagFilter}>
			<option value="">{t($locale, 'allTags')}</option>{#each tags as tag (tag.id)}<option
					value={tag.id}
				>
					{tag.name}
				</option>{/each}
		</select>
	</label>
	<button class="primary" onclick={newSong}>{t($locale, 'newSong')}</button>
</div>
<div class="grid-two">
	<section class="card">
		<h1>{t($locale, 'songs')}</h1>
		{#if !visibleSongs.length}<p class="muted">{t($locale, 'noSongs')}</p>{/if}
		<ul class="list">
			{#each visibleSongs as song (song.id)}<li>
					<button class:selected={song.id === selectedId} onclick={() => selectSong(song)}>
						{song.title}
					</button>
				</li>{/each}
		</ul>
	</section>
	<section class="card">
		{#if editing}
			<h2>{selectedId ? t($locale, 'edit') : t($locale, 'newSong')}</h2>
			<form onsubmit={saveSong}>
				<label>{t($locale, 'title')}<input bind:value={title} maxlength="160" required /></label>
				<label>
					{t($locale, 'content')}<textarea bind:value={content} spellcheck="false"></textarea>
				</label>
				<div class="actions">
					<button class="primary" disabled={busy}>{t($locale, 'save')}</button><button
						type="button"
						onclick={() => (editing = false)}
					>
						{t($locale, 'cancel')}
					</button>
				</div>
			</form>
			<h3 style="margin-top:1.5rem">{t($locale, 'preview')}</h3>
			<SongViewer {content} />
		{:else if selected}
			<div class="actions" style="justify-content:space-between">
				<h2>{selected.title}</h2>
				<div class="actions">
					<button onclick={() => (editing = true)}>{t($locale, 'edit')}</button><button
						class="danger"
						onclick={deleteSelected}
					>
						{t($locale, 'delete')}
					</button>
				</div>
			</div>
			<SongViewer content={selected.content} />
			<div class="grid-two" style="margin-top:1rem">
				<div>
					<h3>{t($locale, 'manageTags')}</h3>
					{#each tags as tag (tag.id)}<label class="inline-check">
							<input
								type="checkbox"
								checked={chosenTags.includes(tag.id)}
								onchange={() => (chosenTags = toggle(tag.id, chosenTags))}
							/>{tag.name}
						</label>{/each}
				</div>
				<div>
					<h3>{t($locale, 'manageCollections')}</h3>
					{#each collections as collection (collection.id)}<label class="inline-check">
							<input
								type="checkbox"
								checked={chosenCollections.includes(collection.id)}
								onchange={() => (chosenCollections = toggle(collection.id, chosenCollections))}
							/>{collection.name}
						</label>{/each}
				</div>
			</div>
			<button style="margin-top:1rem" disabled={busy} onclick={saveAssignments}>
				{t($locale, 'save')}
			</button>
		{:else}<p class="muted">{t($locale, 'selectSong')}</p>{/if}
		{#if message}<p class={message === t($locale, 'saved') ? 'success' : 'error'} role="status">
				{message}
			</p>{/if}
	</section>
</div>
