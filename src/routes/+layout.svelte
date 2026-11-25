<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, refreshAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { locale, initLocale, setLocale, t } from '#lib/client/i18n.js';
	import { request } from '#lib/client/api.js';
	import Icon from '#lib/components/Icon.svelte';
	import './layout.css';

	let { data, children } = $props();
	let dark = $state(false);
	onMount(() => {
		initLocale();
		dark = localStorage.getItem('chordrrific-theme') === 'dark';
		document.documentElement.dataset.theme = dark ? 'dark' : 'light';
	});
	function toggleTheme() {
		dark = !dark;
		document.documentElement.dataset.theme = dark ? 'dark' : 'light';
		localStorage.setItem('chordrrific-theme', dark ? 'dark' : 'light');
	}
	async function signOut() {
		await request('/api/auth/logout', 'POST');
		await refreshAll();
		await goto(resolve('/login'));
	}
</script>

<header class="site-header">
	<a class="brand" href={resolve(data.user ? '/app' : '/login')} aria-label="Chordrrific">
		<span class="brand-mark">♫</span><span>Chordrrific</span>
	</a>
	<nav class="header-actions" aria-label="Main navigation">
		<button
			class="icon-button"
			type="button"
			onclick={toggleTheme}
			aria-label={t($locale, dark ? 'lightMode' : 'darkMode')}
			title={t($locale, dark ? 'lightMode' : 'darkMode')}
		>
			<Icon name={dark ? 'sun' : 'moon'} />
		</button>
		<details class="header-menu">
			<summary
				class="icon-button"
				aria-label={t($locale, 'language')}
				title={t($locale, 'language')}
			>
				<Icon name="globe" />
			</summary>
			<div class="header-dropdown language-options">
				<button type="button" class:active={$locale === 'es'} onclick={() => setLocale('es')}>
					Español
				</button><button
					type="button"
					class:active={$locale === 'en'}
					onclick={() => setLocale('en')}
				>
					English
				</button>
			</div>
		</details>
		{#if data.user}
			<details class="header-menu">
				<summary
					class="icon-button"
					aria-label={t($locale, 'userMenu')}
					title={t($locale, 'userMenu')}
				>
					<Icon name="user" />
				</summary>
				<div class="header-dropdown">
					<span class="menu-email">{data.user.email}</span><a href={resolve('/app/settings')}>
						{t($locale, 'settings')}
					</a>{#if data.user.isAdmin}<a href={resolve('/app/admin')}>
							{t($locale, 'admin')}
						</a>{/if}<button type="button" onclick={signOut}>{t($locale, 'signOut')}</button>
				</div>
			</details>
		{/if}
	</nav>
</header>
<main>{@render children()}</main>
