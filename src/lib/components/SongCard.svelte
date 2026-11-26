<script lang="ts">
	import { songMetadata } from '#lib/core/song-metadata.js';
	import { displayAuthor } from '#lib/client/library.js';
	import { locale, t } from '#lib/client/i18n.js';
	import type { Song } from '#lib/client/types.js';
	import Icon from './Icon.svelte';
	let { song, selected, onOpen, onEdit, onDelete, onTags, onCollections } = $props<{
		song: Song;
		selected: boolean;
		onOpen: (event: MouseEvent) => void;
		onEdit: () => void;
		onDelete: () => void;
		onTags: () => void;
		onCollections: () => void;
	}>();
	let metadata = $derived(songMetadata(song.content));
	let author = $derived(displayAuthor(metadata));
</script>

<article class="song-card" class:selected>
	<button
		type="button"
		class="song-card-main"
		onclick={onOpen}
		aria-label={`${t($locale, 'view')}: ${song.title}`}
	>
		{#if selected}<span class="song-selected"><Icon name="check" size={16} /></span>{/if}
		<strong class="song-card-title">{song.title}</strong>
		{#if author}<span class="song-card-author">{author}</span>{/if}
		{#if metadata.album[0] || metadata.year[0]}<span class="song-card-detail">
				{metadata.album[0] ?? ''}{metadata.album[0] && metadata.year[0] ? ' · ' : ''}{metadata
					.year[0] ?? ''}
			</span>{/if}
	</button>
	{#if song.collections.length}<div class="song-card-collections">
			{#each song.collections as link (link.collectionId)}<span class="collection-chip">
					{link.collection.name}
				</span>{/each}
		</div>{/if}
	{#if metadata.tag.length}<div class="song-card-tags">
			{#each metadata.tag as tag (tag)}<span class="tag-chip">{tag}</span>{/each}
		</div>{/if}
	<div class="song-card-actions">
		<button
			type="button"
			class="icon-button"
			onclick={onOpen}
			aria-label={`${t($locale, 'view')}: ${song.title}`}
			title={t($locale, 'view')}
		>
			<Icon name="eye" size={18} />
		</button>
		<button
			type="button"
			class="icon-button"
			onclick={onEdit}
			aria-label={`${t($locale, 'edit')}: ${song.title}`}
			title={t($locale, 'edit')}
		>
			<Icon name="edit" size={18} />
		</button>
		<button
			type="button"
			class="icon-button"
			onclick={onTags}
			aria-label={`${t($locale, 'editTags')}: ${song.title}`}
			title={t($locale, 'editTags')}
		>
			<Icon name="tag" size={18} />
		</button>
		<button
			type="button"
			class="icon-button"
			onclick={onCollections}
			aria-label={`${t($locale, 'editCollections')}: ${song.title}`}
			title={t($locale, 'editCollections')}
		>
			<Icon name="folder" size={18} />
		</button>
		<button
			type="button"
			class="icon-button danger"
			onclick={onDelete}
			aria-label={`${t($locale, 'delete')}: ${song.title}`}
			title={t($locale, 'delete')}
		>
			<Icon name="trash" size={18} />
		</button>
	</div>
</article>
