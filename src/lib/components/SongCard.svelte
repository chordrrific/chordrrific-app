<script lang="ts">
	import { songMetadata } from '#lib/core/song-metadata.js';
	import { displayAuthorFacet, type FacetKey } from '#lib/client/library.js';
	import { locale, t } from '#lib/client/i18n.js';
	import type { Song } from '#lib/client/types.js';
	import Icon from './Icon.svelte';
	let {
		song,
		number,
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
		onCollections,
		onFilter
	} = $props<{
		song: Song;
		number: number;
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
		onFilter: (key: FacetKey, value: string) => void;
	}>();
	let metadata = $derived(songMetadata(song.content));
	let author = $derived(displayAuthorFacet(metadata));

	function openFromCard(event: MouseEvent) {
		if (
			event.target instanceof Element &&
			event.target.closest('button, a, input, select, textarea, [contenteditable="true"]')
		)
			return;
		onOpen(event);
	}

	function cardClick(node: HTMLElement) {
		node.addEventListener('click', openFromCard);
		return { destroy: () => node.removeEventListener('click', openFromCard) };
	}
</script>

<!-- The title button remains the keyboard-accessible way to open the song. -->
<article
	class="song-card"
	class:selected
	class:reorderable
	class:dragging
	class:drop-target={dropTarget}
	data-song-id={reorderable ? song.id : undefined}
	use:cardClick
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
	<div class="song-card-main">
		<button
			type="button"
			class="song-card-title song-card-title-button"
			onclick={onOpen}
			aria-label={`${t($locale, 'view')}: ${song.title}`}
		>
			{song.title}
		</button>
		{#if author}<button
				type="button"
				class="song-card-author song-card-meta-button"
				onclick={() => onFilter(author.key, author.value)}
				aria-label={`${t($locale, 'addFilter')}: ${t($locale, author.key)} ${author.value}`}
			>
				{author.value}
			</button>{/if}
		{#if metadata.album[0] || metadata.year[0]}<div class="song-card-detail">
				{#if metadata.album[0]}<button
						type="button"
						class="song-card-meta-button"
						onclick={() => onFilter('album', metadata.album[0])}
						aria-label={`${t($locale, 'addFilter')}: ${t($locale, 'album')} ${metadata.album[0]}`}
					>
						{metadata.album[0]}
					</button>{/if}
				{#if metadata.album[0] && metadata.year[0]}<span aria-hidden="true">·</span>{/if}
				{#if metadata.year[0]}<button
						type="button"
						class="song-card-meta-button"
						onclick={() => onFilter('year', metadata.year[0])}
						aria-label={`${t($locale, 'addFilter')}: ${t($locale, 'year')} ${metadata.year[0]}`}
					>
						{metadata.year[0]}
					</button>{/if}
			</div>{/if}
	</div>
	{#if song.collections.length}<div class="song-card-collections">
			{#each song.collections as link (link.collectionId)}<button
					type="button"
					class="collection-chip song-card-chip-button"
					onclick={() => onFilter('collection', link.collection.name)}
					aria-label={`${t($locale, 'addFilter')}: ${t($locale, 'collection')} ${link.collection.name}`}
				>
					{link.collection.name}
				</button>{/each}
		</div>{/if}
	{#if metadata.tag.length}<div class="song-card-tags">
			{#each metadata.tag as tag (tag)}<button
					type="button"
					class="tag-chip song-card-chip-button"
					onclick={() => onFilter('tag', tag)}
					aria-label={`${t($locale, 'addFilter')}: ${t($locale, 'tag')} ${tag}`}
				>
					{tag}
				</button>{/each}
		</div>{/if}
	<div class="song-card-footer">
		<span class="song-card-number">{number}</span>
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
	</div>
</article>
