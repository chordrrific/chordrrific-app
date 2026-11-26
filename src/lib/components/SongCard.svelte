<script lang="ts">
	import { songMetadata } from '#lib/core/song-metadata.js';
	import { displayAuthor } from '#lib/client/library.js';
	import { locale, t } from '#lib/client/i18n.js';
	import type { Song } from '#lib/client/types.js';
	import Icon from './Icon.svelte';
	let {
		song,
		selected,
		reorderable,
		reorderDisabled,
		dragging,
		dropTarget,
		onReorderStart,
		onReorderKey,
		onOpen,
		onSelect,
		onEdit,
		onDelete,
		onTags,
		onCollections
	} = $props<{
		song: Song;
		selected: boolean;
		reorderable: boolean;
		reorderDisabled: boolean;
		dragging: boolean;
		dropTarget: boolean;
		onReorderStart: (event: PointerEvent) => void;
		onReorderKey: (delta: number) => void;
		onOpen: (event: MouseEvent) => void;
		onSelect: () => void;
		onEdit: () => void;
		onDelete: () => void;
		onTags: () => void;
		onCollections: () => void;
	}>();
	let metadata = $derived(songMetadata(song.content));
	let author = $derived(displayAuthor(metadata));
</script>

<article
	class="song-card"
	class:selected
	class:reorderable
	class:dragging
	class:drop-target={dropTarget}
	data-song-id={reorderable ? song.id : undefined}
>
	{#if reorderable}<button
			type="button"
			class="song-drag-handle"
			disabled={reorderDisabled}
			onpointerdown={onReorderStart}
			onkeydown={(event) => {
				if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
				event.preventDefault();
				event.stopPropagation();
				onReorderKey(event.key === 'ArrowUp' ? -1 : 1);
			}}
			aria-label={`${t($locale, 'reorderSong')}: ${song.title}`}
			title={t($locale, 'reorderSong')}
		>
			<Icon name="grip" size={20} />
		</button>{/if}
	<button
		type="button"
		class="song-select-toggle"
		class:selected
		onclick={onSelect}
		aria-label={`${t($locale, selected ? 'removeFromSelection' : 'addToSelection')}: ${song.title}`}
		aria-pressed={selected}
	>
		{#if selected}<Icon name="check" size={16} />{/if}
	</button>
	<button
		type="button"
		class="song-card-main"
		onclick={onOpen}
		aria-label={`${t($locale, 'view')}: ${song.title}`}
	>
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
