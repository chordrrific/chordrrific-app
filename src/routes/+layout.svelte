<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, refreshAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { locale, initLocale, setLocale, t } from '#lib/client/i18n.js';
	import { request } from '#lib/client/api.js';
	import Icon from '#lib/components/Icon.svelte';
	import NotificationCenter from '#lib/components/NotificationCenter.svelte';
	import ConfirmationDialog from '#lib/components/ConfirmationDialog.svelte';
	import { confirmation, resolveConfirmation } from '#lib/client/confirmation.js';
	import { initializeNotifications } from '#lib/client/notifications.js';
	import { refreshCatalog } from '#lib/client/catalog-state.js';
	import { chordProFileAccept } from '#lib/client/song-import.js';
	import { importSongsWithReport } from '#lib/client/song-import-flow.js';
	import './layout.css';

	let { data, children } = $props();
	let dark = $state(false);
	let openMenu = $state<'language' | 'notifications' | 'user' | null>(null);
	let importing = $state(false);
	let importInput: HTMLInputElement;
	onMount(() => {
		initLocale();
		dark = localStorage.getItem('chordrrific-theme') === 'dark';
		document.documentElement.dataset.theme = dark ? 'dark' : 'light';
	});
	$effect(() => {
		if (typeof window !== 'undefined') void initializeNotifications(data.user?.id ?? null);
	});
	function toggleTheme() {
		dark = !dark;
		document.documentElement.dataset.theme = dark ? 'dark' : 'light';
		localStorage.setItem('chordrrific-theme', dark ? 'dark' : 'light');
	}
	function toggleMenu(menu: 'language' | 'notifications' | 'user') {
		openMenu = openMenu === menu ? null : menu;
	}
	function outsideMenu(event: PointerEvent) {
		if (openMenu && event.target instanceof Element && !event.target.closest('.header-menu'))
			openMenu = null;
	}
	function closeMenuOnEscape(event: KeyboardEvent) {
		if (openMenu && event.key === 'Escape') {
			openMenu = null;
			event.stopImmediatePropagation();
		}
	}
	function chooseLanguage(value: 'es' | 'en') {
		setLocale(value);
		openMenu = null;
	}
	function openImportPicker() {
		openMenu = null;
		importInput.click();
	}
	async function importSelected(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = '';
		if (!files.length) return;
		importing = true;
		try {
			const imported = await importSongsWithReport(files, $locale);
			if (imported) {
				refreshCatalog();
				if (window.location.pathname.replace(/\/$/, '') !== resolve('/app'))
					await goto(resolve('/app'));
			}
		} finally {
			importing = false;
		}
	}
	async function signOut() {
		openMenu = null;
		await request('/api/auth/logout', 'POST');
		await initializeNotifications(null);
		await refreshAll();
		await goto(resolve('/login'));
	}
</script>

<svelte:window onpointerdown={outsideMenu} onkeydown={closeMenuOnEscape} />
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
		<div class="header-menu">
			<button
				class="icon-button"
				type="button"
				aria-label={t($locale, 'language')}
				title={t($locale, 'language')}
				aria-expanded={openMenu === 'language'}
				onclick={() => toggleMenu('language')}
			>
				<Icon name="globe" />
			</button>
			{#if openMenu === 'language'}<div class="header-dropdown language-options">
					<button
						type="button"
						class:active={$locale === 'es'}
						onclick={() => chooseLanguage('es')}
					>
						Español
					</button><button
						type="button"
						class:active={$locale === 'en'}
						onclick={() => chooseLanguage('en')}
					>
						English
					</button>
				</div>{/if}
		</div>
		{#if data.user}
			<NotificationCenter
				open={openMenu === 'notifications'}
				onToggle={() => toggleMenu('notifications')}
				onClose={() => (openMenu = null)}
			/>
			<div class="header-menu">
				<button
					class="icon-button"
					type="button"
					aria-label={t($locale, 'userMenu')}
					title={t($locale, 'userMenu')}
					aria-expanded={openMenu === 'user'}
					onclick={() => toggleMenu('user')}
				>
					<Icon name="user" />
				</button>
				{#if openMenu === 'user'}<div class="header-dropdown">
						<a
							class="menu-email"
							href={resolve('/app/settings')}
							aria-label={`${t($locale, 'settings')}: ${data.user.email}`}
							onclick={() => (openMenu = null)}
						>
							{data.user.email}
						</a>{#if data.user.isAdmin}<a
								href={resolve('/app/admin')}
								onclick={() => (openMenu = null)}
							>
								{t($locale, 'admin')}
							</a>{/if}<button type="button" disabled={importing} onclick={openImportPicker}>
							{t($locale, importing ? 'importingSongs' : 'importSongs')}
						</button><button type="button" onclick={signOut}>{t($locale, 'signOut')}</button>
					</div>{/if}
			</div>
		{/if}
	</nav>
</header>
<input
	bind:this={importInput}
	type="file"
	accept={chordProFileAccept}
	multiple
	hidden
	aria-label={t($locale, 'importSongs')}
	onchange={importSelected}
/>
<main>{@render children()}</main>
{#if $confirmation}<ConfirmationDialog
		request={$confirmation}
		onResolve={resolveConfirmation}
	/>{/if}
