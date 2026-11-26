<script lang="ts">
	import { locale, t } from '#lib/client/i18n.js';
	import {
		dismissToast,
		markRead,
		notifications,
		removeAllNotifications,
		removeNotification,
		toasts
	} from '#lib/client/notifications.js';
	import Icon from './Icon.svelte';

	let { open, onToggle, onClose } = $props<{
		open: boolean;
		onToggle: () => void;
		onClose: () => void;
	}>();
	let failure = $state('');
	let unread = $derived($notifications.filter((entry) => !entry.readAt).length);
	async function act(action: () => Promise<void>) {
		failure = '';
		onClose();
		try {
			await action();
		} catch (cause) {
			failure = cause instanceof Error ? cause.message : String(cause);
		}
	}
	function clearAll() {
		onClose();
		if (!$notifications.length || !confirm(t($locale, 'confirmDeleteAllNotifications'))) return;
		void act(removeAllNotifications);
	}
	function date(value: string): string {
		return new Intl.DateTimeFormat($locale, { dateStyle: 'short', timeStyle: 'short' }).format(
			new Date(value)
		);
	}
</script>

<div class="header-menu notification-menu">
	<button
		class="icon-button notification-bell"
		type="button"
		aria-label={t($locale, 'notifications')}
		title={t($locale, 'notifications')}
		aria-expanded={open}
		onclick={onToggle}
	>
		<Icon name="bell" />
		{#if unread > 0}<span class="notification-badge">{unread > 99 ? '99+' : unread}</span>{/if}
	</button>
	{#if open}<div class="notification-panel">
			<div class="notification-panel-header">
				<h2>{t($locale, 'notifications')}</h2>
				<button
					type="button"
					class="icon-button danger"
					disabled={!$notifications.length}
					onclick={clearAll}
					aria-label={t($locale, 'deleteAllNotifications')}
					title={t($locale, 'deleteAllNotifications')}
				>
					<Icon name="trash" size={18} />
				</button>
			</div>
			{#if !$notifications.length}<p class="muted">{t($locale, 'noNotifications')}</p>{/if}
			{#if failure}<p class="error" role="alert">{failure}</p>{/if}
			<ul>
				{#each $notifications as entry (entry.id)}
					<li class:unread={!entry.readAt} class:error-kind={entry.kind === 'error'}>
						<div class="notification-entry-heading">
							<strong>{entry.title}</strong><time datetime={entry.createdAt}>
								{date(entry.createdAt)}
							</time>
						</div>
						{#if entry.body}<p>{entry.body}</p>{/if}
						<div class="notification-actions">
							{#if !entry.readAt}<button
									type="button"
									onclick={() => act(() => markRead(entry.id))}
								>
									<Icon name="check" size={15} />{t($locale, 'markAsRead')}
								</button>{/if}
							<button type="button" onclick={() => act(() => removeNotification(entry.id))}>
								<Icon name="trash" size={15} />{t($locale, 'deleteNotification')}
							</button>
						</div>
					</li>
				{/each}
			</ul>
		</div>{/if}
</div>

<div class="toast-stack" aria-live="polite">
	{#each $toasts as entry (entry.id)}
		<div
			class="notification-toast"
			class:error-kind={entry.kind === 'error'}
			role={entry.kind === 'error' ? 'alert' : 'status'}
		>
			<div>
				<strong>{entry.title}</strong>{#if entry.body}<p>{entry.body}</p>{/if}
			</div>
			<button
				type="button"
				class="icon-button"
				onclick={() => dismissToast(entry.id)}
				aria-label={t($locale, 'close')}
			>
				<Icon name="close" size={17} />
			</button>
		</div>
	{/each}
</div>
