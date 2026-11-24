<script lang="ts">
	import { onMount } from 'svelte';
	import { request } from '#lib/client/api.js';
	import { collectionSongIds, moved } from '#lib/client/catalog.js';
	import { locale, t } from '#lib/client/i18n.js';
	import type { Collection, Song } from '#lib/client/types.js';

	let collections = $state<Collection[]>([]);
	let songs = $state<Song[]>([]);
	let name = $state('');
	let editingId = $state<string | null>(null);
	let editingName = $state('');
	let chosenSong = $state<Record<string, string>>({});
	let message = $state('');
	async function load() {
		try {
			[collections, songs] = await Promise.all([
				request<Collection[]>('/api/collections'),
				request<Song[]>('/api/songs')
			]);
		} catch (cause) {
			message = cause instanceof Error ? cause.message : String(cause);
		}
	}
	onMount(() => {
		void load();
	});
	async function create(event: SubmitEvent) {
		event.preventDefault();
		message = '';
		try {
			await request('/api/collections', 'POST', { name });
			name = '';
			await load();
		} catch (cause) {
			message = cause instanceof Error ? cause.message : String(cause);
		}
	}
	async function rename() {
		if (!editingId) return;
		try {
			await request(`/api/collections/${editingId}`, 'PATCH', { name: editingName });
			editingId = null;
			await load();
		} catch (cause) {
			message = cause instanceof Error ? cause.message : String(cause);
		}
	}
	async function remove(id: string) {
		if (!confirm(t($locale, 'confirmDelete'))) return;
		try {
			await request(`/api/collections/${id}`, 'DELETE');
			await load();
		} catch (cause) {
			message = cause instanceof Error ? cause.message : String(cause);
		}
	}
	async function setSongs(id: string, ids: string[]) {
		try {
			await request(`/api/collections/${id}/songs`, 'PUT', { songIds: ids });
			await load();
		} catch (cause) {
			message = cause instanceof Error ? cause.message : String(cause);
		}
	}
</script>

<svelte:head><title>{t($locale, 'collections')} · Chordrrific</title></svelte:head>
<h1>{t($locale, 'collections')}</h1>
<section class="card" style="margin-bottom:1rem">
	<form class="toolbar" onsubmit={create}>
		<label>
			{t($locale, 'newCollection')}<input bind:value={name} maxlength="100" required />
		</label><button class="primary">{t($locale, 'create')}</button>
	</form>
</section>
{#if !collections.length}<p class="muted">{t($locale, 'noCollections')}</p>{/if}
<div class="stack">
	{#each collections as collection (collection.id)}
		{@const ids = collectionSongIds(collection)}
		<section class="card">
			<div class="actions" style="justify-content:space-between">
				{#if editingId === collection.id}<input
						aria-label={t($locale, 'name')}
						bind:value={editingName}
					/><button onclick={rename}>{t($locale, 'save')}</button>
				{:else}<h2>{collection.name}</h2>
					<button
						onclick={() => {
							editingId = collection.id;
							editingName = collection.name;
						}}
					>
						{t($locale, 'edit')}
					</button>{/if}
				<button class="danger" onclick={() => remove(collection.id)}>{t($locale, 'delete')}</button>
			</div>
			<h3>{t($locale, 'collectionSongs')}</h3>
			<ul class="list">
				{#each collection.songs as entry, index (entry.songId)}
					<li>
						<span>{index + 1}. {entry.song.title}</span>
						<div class="actions">
							<button
								disabled={index === 0}
								onclick={() => setSongs(collection.id, moved(ids, index, -1))}
								aria-label={t($locale, 'up')}
							>
								{t($locale, 'up')}
							</button><button
								disabled={index === ids.length - 1}
								onclick={() => setSongs(collection.id, moved(ids, index, 1))}
								aria-label={t($locale, 'down')}
							>
								{t($locale, 'down')}
							</button><button
								onclick={() =>
									setSongs(
										collection.id,
										ids.filter((id) => id !== entry.songId)
									)}
							>
								{t($locale, 'remove')}
							</button>
						</div>
					</li>
				{/each}
			</ul>
			<div class="actions">
				<select
					aria-label={t($locale, 'chooseSong')}
					value={chosenSong[collection.id] ?? ''}
					onchange={(event) => (chosenSong[collection.id] = event.currentTarget.value)}
				>
					<option value="">
						{t($locale, 'chooseSong')}
					</option>{#each songs.filter((song) => !ids.includes(song.id)) as song (song.id)}<option
							value={song.id}
						>
							{song.title}
						</option>{/each}
				</select><button
					disabled={!chosenSong[collection.id]}
					onclick={() => {
						void setSongs(collection.id, [...ids, chosenSong[collection.id]]);
						chosenSong[collection.id] = '';
					}}
				>
					{t($locale, 'addSong')}
				</button>
			</div>
		</section>
	{/each}
</div>
{#if message}<p class="error" role="alert">{message}</p>{/if}
