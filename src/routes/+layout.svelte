<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, refreshAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { locale, initLocale, setLocale, t } from '#lib/client/i18n.js';
	import { request } from '#lib/client/api.js';
	import './layout.css';

	let { data, children } = $props();
	onMount(initLocale);
	async function signOut() {
		await request('/api/auth/logout', 'POST');
		await refreshAll();
		await goto(resolve('/login'));
	}
</script>

<header class="site-header">
	<a class="brand" href={resolve(data.user ? '/app' : '/login')}>♫ {t($locale, 'brand')}</a>
	<nav aria-label="Main navigation">
		{#if data.user}
			<a href={resolve('/app')}>{t($locale, 'songs')}</a>
			<a href={resolve('/app/collections')}>{t($locale, 'collections')}</a>
			<a href={resolve('/app/tags')}>{t($locale, 'tags')}</a>
			{#if data.user.isAdmin}<a href={resolve('/app/admin')}>{t($locale, 'admin')}</a>{/if}
			<a href={resolve('/app/settings')}>{t($locale, 'settings')}</a>
			<button class="nav-button" onclick={signOut}>{t($locale, 'signOut')}</button>
		{/if}
	</nav>
	<div class="language-switch" aria-label="Language">
		<button class:active={$locale === 'es'} onclick={() => setLocale('es')}>ES</button>
		<button class:active={$locale === 'en'} onclick={() => setLocale('en')}>EN</button>
	</div>
</header>
<main>{@render children()}</main>
