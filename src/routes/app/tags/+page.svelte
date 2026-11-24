<script lang="ts">
	import { onMount } from 'svelte';
	import { request } from '#lib/client/api.js';
	import { locale, t } from '#lib/client/i18n.js';
	import type { Tag } from '#lib/client/types.js';
	let tags = $state<Tag[]>([]);
	let name = $state('');
	let editingId = $state<string | null>(null);
	let editingName = $state('');
	let message = $state('');
	async function load() {
		try {
			tags = await request<Tag[]>('/api/tags');
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
			await request('/api/tags', 'POST', { name });
			name = '';
			await load();
		} catch (cause) {
			message = cause instanceof Error ? cause.message : String(cause);
		}
	}
	async function rename() {
		if (!editingId) return;
		try {
			await request(`/api/tags/${editingId}`, 'PATCH', { name: editingName });
			editingId = null;
			await load();
		} catch (cause) {
			message = cause instanceof Error ? cause.message : String(cause);
		}
	}
	async function remove(id: string) {
		if (!confirm(t($locale, 'confirmDelete'))) return;
		try {
			await request(`/api/tags/${id}`, 'DELETE');
			await load();
		} catch (cause) {
			message = cause instanceof Error ? cause.message : String(cause);
		}
	}
</script>

<svelte:head><title>{t($locale, 'tags')} · Chordrrific</title></svelte:head>
<h1>{t($locale, 'tags')}</h1>
<section class="card" style="margin-bottom:1rem">
	<form class="toolbar" onsubmit={create}>
		<label>{t($locale, 'newTag')}<input bind:value={name} maxlength="60" required /></label><button
			class="primary"
		>
			{t($locale, 'create')}
		</button>
	</form>
</section>
<section class="card">
	{#if !tags.length}<p class="muted">{t($locale, 'noTags')}</p>{/if}
	<ul class="list">
		{#each tags as tag (tag.id)}<li>
				{#if editingId === tag.id}<input
						aria-label={t($locale, 'name')}
						bind:value={editingName}
					/><button onclick={rename}>{t($locale, 'save')}</button>
				{:else}<span>{tag.name}</span><button
						onclick={() => {
							editingId = tag.id;
							editingName = tag.name;
						}}
					>
						{t($locale, 'edit')}
					</button>{/if}
				<button class="danger" onclick={() => remove(tag.id)}>{t($locale, 'delete')}</button>
			</li>{/each}
	</ul>
</section>
{#if message}<p class="error" role="alert">{message}</p>{/if}
