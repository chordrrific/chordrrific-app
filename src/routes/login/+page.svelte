<script lang="ts">
	import { goto, refreshAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { request } from '#lib/client/api.js';
	import { locale, t } from '#lib/client/i18n.js';
	import { keyboardShortcuts } from '#lib/client/keyboard-shortcuts.js';
	let email = $state('');
	let password = $state('');
	let message = $state('');
	let busy = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		message = '';
		try {
			await request('/api/auth/login', 'POST', { email, password });
			await refreshAll();
			await goto(resolve('/app'));
		} catch (cause) {
			message = cause instanceof Error ? cause.message : t($locale, 'loginFailed');
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>{t($locale, 'signIn')} · Chordrrific</title></svelte:head>
<section class="auth-card">
	<h1>{t($locale, 'privateLibrary')}</h1>
	<p>{t($locale, 'intro')}</p>
	<form
		onsubmit={submit}
		use:keyboardShortcuts={{
			onCancel: () => {
				email = '';
				password = '';
				message = '';
			}
		}}
	>
		<label>
			{t($locale, 'email')}<input
				type="email"
				autocomplete="username"
				bind:value={email}
				required
			/>
		</label>
		<label>
			{t($locale, 'password')}<input
				type="password"
				autocomplete="current-password"
				bind:value={password}
				required
			/>
		</label>
		<button class="primary" disabled={busy}>{t($locale, 'signIn')}</button>
	</form>
	{#if message}<p class="error" role="alert">{message}</p>{/if}
</section>
