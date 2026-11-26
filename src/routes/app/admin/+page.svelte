<script lang="ts">
	import { onMount } from 'svelte';
	import { request } from '#lib/client/api.js';
	import { locale, t } from '#lib/client/i18n.js';
	import { confirmAction } from '#lib/client/confirmation.js';
	import { keyboardShortcuts } from '#lib/client/keyboard-shortcuts.js';
	import type { User } from '#lib/client/types.js';
	let users = $state<User[]>([]);
	let email = $state('');
	let password = $state('');
	let isAdmin = $state(false);
	let resetId = $state<string | null>(null);
	let resetPassword = $state('');
	let message = $state('');
	async function load() {
		try {
			users = await request<User[]>('/api/users');
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
			await request('/api/users', 'POST', { email, password, isAdmin });
			email = '';
			password = '';
			isAdmin = false;
			await load();
		} catch (cause) {
			message = cause instanceof Error ? cause.message : String(cause);
		}
	}
	async function toggleAdmin(user: User) {
		try {
			await request(`/api/users/${user.id}`, 'PATCH', { isAdmin: !user.isAdmin });
			await load();
		} catch (cause) {
			message = cause instanceof Error ? cause.message : String(cause);
		}
	}
	async function changePassword(event: SubmitEvent) {
		event.preventDefault();
		if (!resetId) return;
		try {
			await request(`/api/users/${resetId}`, 'PATCH', { password: resetPassword });
			resetId = null;
			resetPassword = '';
			message = t($locale, 'saved');
		} catch (cause) {
			message = cause instanceof Error ? cause.message : String(cause);
		}
	}
	async function remove(user: User) {
		if (!(await confirmAction(t($locale, 'confirmDelete'), { destructive: true }))) return;
		try {
			await request(`/api/users/${user.id}`, 'DELETE');
			await load();
		} catch (cause) {
			message = cause instanceof Error ? cause.message : String(cause);
		}
	}
</script>

<svelte:head><title>{t($locale, 'admin')} · Chordrrific</title></svelte:head>
<h1>{t($locale, 'admin')}</h1>
<div class="grid-two">
	<section class="card">
		<h2>{t($locale, 'newUser')}</h2>
		<form
			onsubmit={create}
			use:keyboardShortcuts={{
				onCancel: () => {
					email = '';
					password = '';
					isAdmin = false;
				}
			}}
		>
			<label>
				{t($locale, 'email')}<input type="email" autocomplete="off" bind:value={email} required />
			</label>
			<label>
				{t($locale, 'password')}<input
					type="password"
					autocomplete="new-password"
					minlength="12"
					bind:value={password}
					required
				/>
			</label>
			<label class="inline-check">
				<input type="checkbox" bind:checked={isAdmin} />{t($locale, 'adminRole')}
			</label>
			<button class="primary">{t($locale, 'create')}</button>
		</form>
	</section>
	<section class="card">
		<h2>{t($locale, 'admin')}</h2>
		{#if !users.length}<p class="muted">{t($locale, 'noUsers')}</p>{/if}
		<ul class="list">
			{#each users as user (user.id)}<li>
					<div>
						<strong>{user.email}</strong>{#if user.isAdmin}<small>
								· {t($locale, 'adminRole')}
							</small>{/if}
					</div>
					<div class="actions">
						<button onclick={() => toggleAdmin(user)}>
							{t($locale, 'adminRole')}: {user.isAdmin ? '✓' : '—'}
						</button><button
							onclick={() => {
								resetId = user.id;
								resetPassword = '';
							}}
						>
							{t($locale, 'resetPassword')}
						</button><button class="danger" onclick={() => remove(user)}>
							{t($locale, 'delete')}
						</button>
					</div>
				</li>{/each}
		</ul>
		{#if resetId}<form
				onsubmit={changePassword}
				use:keyboardShortcuts={{
					onCancel: () => {
						resetId = null;
						resetPassword = '';
					}
				}}
			>
				<label>
					{t($locale, 'newPassword')}<input
						type="password"
						minlength="12"
						autocomplete="new-password"
						bind:value={resetPassword}
						required
					/>
				</label>
				<div class="actions">
					<button class="primary">{t($locale, 'save')}</button><button
						type="button"
						onclick={() => (resetId = null)}
					>
						{t($locale, 'cancel')}
					</button>
				</div>
			</form>{/if}
	</section>
</div>
{#if message}<p class={message === t($locale, 'saved') ? 'success' : 'error'} role="status">
		{message}
	</p>{/if}
