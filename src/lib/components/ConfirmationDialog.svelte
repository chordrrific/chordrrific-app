<script lang="ts">
	import type { ConfirmationRequest } from '#lib/client/confirmation.js';

	let { request, onResolve } = $props<{
		request: ConfirmationRequest;
		onResolve: (confirmed: boolean) => void;
	}>();
	function openDialog(node: HTMLDialogElement) {
		node.showModal();
		node.querySelector<HTMLButtonElement>('button')?.focus();
		return {
			destroy() {
				if (node.open) node.close();
			}
		};
	}
</script>

<dialog
	class="unsaved-dialog confirmation-dialog"
	use:openDialog
	role="alertdialog"
	aria-modal="true"
	aria-label={request.message}
	oncancel={(event) => {
		event.preventDefault();
		onResolve(false);
	}}
	onkeydown={(event) => {
		if (event.key === 'Escape') event.stopPropagation();
	}}
>
	<p>{request.message}</p>
	<div class="actions">
		<button type="button" onclick={() => onResolve(false)}>
			{request.cancelLabel}
		</button>
		<button
			type="button"
			class:danger={request.destructive}
			class:primary={!request.destructive}
			onclick={() => onResolve(true)}
		>
			{request.confirmLabel}
		</button>
	</div>
</dialog>
