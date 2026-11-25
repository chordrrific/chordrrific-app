<script lang="ts">
	import { locale, t } from '#lib/client/i18n.js';
	import type { Facet, FacetKey, FacetSelection } from '#lib/client/library.js';
	import Icon from './Icon.svelte';
	let { facets, active, pinned, expanded, onChoose, onPin, onExpand } = $props<{
		facets: Facet[];
		active: FacetSelection[];
		pinned: FacetKey[];
		expanded: FacetKey[];
		onChoose: (key: FacetKey, value: string | undefined, additive: boolean) => void;
		onPin: (key: FacetKey) => void;
		onExpand: (key: FacetKey) => void;
	}>();
	let ordered = $derived(
		[...facets].sort((a, b) => {
			const aIndex = pinned.indexOf(a.key);
			const bIndex = pinned.indexOf(b.key);
			if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
			if (aIndex >= 0) return -1;
			if (bIndex >= 0) return 1;
			return facets.indexOf(a) - facets.indexOf(b);
		})
	);
	function state(key: FacetKey, value?: string): FacetSelection['mode'] | undefined {
		return active.find((item: FacetSelection) => item.key === key && item.value === value)?.mode;
	}
</script>

<div class="facet-list">
	{#each ordered as facet (facet.key)}
		<section class:pinned={pinned.includes(facet.key)} class="facet-section">
			<div class="facet-heading">
				<button
					type="button"
					class="facet-expand"
					onclick={() => onExpand(facet.key)}
					aria-label={`${t($locale, expanded.includes(facet.key) ? 'collapse' : 'expand')} ${t($locale, facet.key)}`}
					aria-expanded={expanded.includes(facet.key)}
				>
					<Icon name="chevron" size={17} />
				</button>
				<button
					type="button"
					class="facet-choice"
					class:included={state(facet.key) === 'include'}
					class:excluded={state(facet.key) === 'exclude'}
					onclick={(event) => onChoose(facet.key, undefined, event.ctrlKey || event.metaKey)}
				>
					<span class="facet-sign">
						{state(facet.key) === 'include' ? '+' : state(facet.key) === 'exclude' ? '−' : ''}
					</span><span>{t($locale, facet.key)}</span><span class="facet-count">{facet.count}</span>
				</button>
				<button
					type="button"
					class="facet-pin"
					class:active={pinned.includes(facet.key)}
					onclick={() => onPin(facet.key)}
					aria-label={`${t($locale, pinned.includes(facet.key) ? 'unpin' : 'pin')} ${t($locale, facet.key)}`}
					title={t($locale, pinned.includes(facet.key) ? 'unpin' : 'pin')}
				>
					<Icon name="pin" size={15} />
				</button>
			</div>
			{#if expanded.includes(facet.key)}<ul class="facet-values">
					{#each facet.values as entry (entry.value)}<li>
							<button
								type="button"
								class="facet-choice"
								class:included={state(facet.key, entry.value) === 'include'}
								class:excluded={state(facet.key, entry.value) === 'exclude'}
								onclick={(event) =>
									onChoose(facet.key, entry.value, event.ctrlKey || event.metaKey)}
							>
								<span class="facet-sign">
									{state(facet.key, entry.value) === 'include'
										? '+'
										: state(facet.key, entry.value) === 'exclude'
											? '−'
											: ''}
								</span><span class="facet-name">{entry.value}</span><span class="facet-count">
									{entry.count}
								</span>
							</button>
						</li>{/each}
				</ul>{/if}
		</section>
	{/each}
</div>
