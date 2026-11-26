<script lang="ts">
	let { name, size = 20 } = $props<{
		name:
			| 'sun'
			| 'moon'
			| 'globe'
			| 'user'
			| 'chevron'
			| 'pin'
			| 'eye'
			| 'edit'
			| 'trash'
			| 'tag'
			| 'folder'
			| 'plus'
			| 'close'
			| 'left'
			| 'right'
			| 'menu'
			| 'search'
			| 'upload'
			| 'check'
			| 'bell'
			| 'grip'
			| 'chorus';
		size?: number;
	}>();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if name === 'sun'}<circle cx="12" cy="12" r="4" /><path
			d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
		/>
	{:else if name === 'moon'}<path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" />
	{:else if name === 'globe'}<circle cx="12" cy="12" r="9" /><path
			d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"
		/>
	{:else if name === 'user'}<circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" />
	{:else if name === 'chevron'}<path d="m7 10 5 5 5-5" />
	{:else if name === 'pin'}<path d="m9 3 6 0-1 6 4 4v2H6v-2l4-4-1-6ZM12 15v7" />
	{:else if name === 'eye'}<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle
			cx="12"
			cy="12"
			r="3"
		/>
	{:else if name === 'edit'}<path d="M4 20h4l11-11-4-4L4 16v4Zm9-13 4 4" />
	{:else if name === 'trash'}<path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6" />
	{:else if name === 'tag'}<path d="M3 12V4h8l10 10-7 7L3 12Z" /><circle cx="8" cy="8" r="1" />
	{:else if name === 'folder'}<path d="M3 6h7l2 2h9v12H3V6Z" />
	{:else if name === 'plus'}<path d="M12 5v14M5 12h14" />
	{:else if name === 'close'}<path d="M5 5 19 19M19 5 5 19" />
	{:else if name === 'left'}<path d="m15 5-7 7 7 7" />
	{:else if name === 'right'}<path d="m9 5 7 7-7 7" />
	{:else if name === 'menu'}<path d="M4 6h16M4 12h16M4 18h16" />
	{:else if name === 'search'}<circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" />
	{:else if name === 'upload'}<path d="M12 16V3m-4 4 4-4 4 4M4 16v5h16v-5" />
	{:else if name === 'check'}<path d="m4 12 5 5L20 6" />
	{:else if name === 'bell'}<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9ZM10 21h4" />
	{:else if name === 'grip'}<circle cx="9" cy="5" r="1" fill="currentColor" stroke="none" /><circle
			cx="15"
			cy="5"
			r="1"
			fill="currentColor"
			stroke="none"
		/><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" /><circle
			cx="15"
			cy="12"
			r="1"
			fill="currentColor"
			stroke="none"
		/><circle cx="9" cy="19" r="1" fill="currentColor" stroke="none" /><circle
			cx="15"
			cy="19"
			r="1"
			fill="currentColor"
			stroke="none"
		/>
	{:else if name === 'chorus'}<path d="M4 3h12v18H4zM7 7h6M7 10h6M7 13h4" /><path
			d="m13 17 6-6 2 2-6 6-3 1z"
		/>{/if}
</svg>
