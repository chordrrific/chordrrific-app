<script lang="ts">
	import { goto, refreshAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { request } from '#lib/client/api.js';
	import { locale, t } from '#lib/client/i18n.js';
	import { keyboardShortcuts } from '#lib/client/keyboard-shortcuts.js';
	let currentPassword = $state('');
	let newPassword = $state('');
	let message = $state('');
	async function submit(event: SubmitEvent) {
		event.preventDefault();
		message = '';
		try {
			await request('/api/auth/password', 'POST', { currentPassword, newPassword });
			await refreshAll();
			await goto(resolve('/login'));
		} catch (cause) {
			message = cause instanceof Error ? cause.message : String(cause);
		}
	}
</script>

<svelte:head><title>{t($locale, 'settings')} · Chordrrific</title></svelte:head>
<section class="card" style="max-width:500px">
	<h1>{t($locale, 'settings')}</h1>
	<form
		onsubmit={submit}
		use:keyboardShortcuts={{
			onCancel: () => {
				currentPassword = '';
				newPassword = '';
				message = '';
			}
		}}
	>
		<label>
			{t($locale, 'currentPassword')}<input
				type="password"
				autocomplete="current-password"
				bind:value={currentPassword}
				required
			/>
		</label>
		<label>
			{t($locale, 'newPassword')}<input
				type="password"
				autocomplete="new-password"
				minlength="12"
				bind:value={newPassword}
				required
			/>
		</label>
		<button class="primary">{t($locale, 'changePassword')}</button>
	</form>
	{#if message}<p class="error" role="alert">{message}</p>{/if}
</section>
