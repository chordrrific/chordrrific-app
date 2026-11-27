export interface MembershipEntry {
	name: string;
	initial: boolean;
	partial: boolean;
	applyToAll: boolean;
}

export interface MembershipDraft {
	entries: MembershipEntry[];
	removed: string[];
}

export function membershipNameKey(name: string): string {
	return name.toLocaleLowerCase();
}

export function createMembershipDraft(namesBySong: string[][]): MembershipDraft {
	const names = new Map<string, { name: string; count: number }>();
	for (const songNames of namesBySong) {
		const seen = new Set<string>();
		for (const name of songNames) {
			const key = membershipNameKey(name);
			if (seen.has(key)) continue;
			seen.add(key);
			const current = names.get(key);
			if (current) current.count += 1;
			else names.set(key, { name, count: 1 });
		}
	}
	return {
		entries: [...names.values()].map(({ name, count }) => ({
			name,
			initial: true,
			partial: count < namesBySong.length,
			applyToAll: false
		})),
		removed: []
	};
}

export function addMembershipNames(draft: MembershipDraft, input: string): MembershipDraft {
	let entries = [...draft.entries];
	let removed = [...draft.removed];
	for (const part of input.split(',')) {
		const name = part.trim();
		if (!name) continue;
		const key = membershipNameKey(name);
		const existing = entries.find((entry) => membershipNameKey(entry.name) === key);
		if (existing) {
			if (existing.partial)
				entries = entries.map((entry) =>
					entry === existing ? { ...entry, partial: false, applyToAll: true } : entry
				);
			continue;
		}
		const restored = removed.find((item) => membershipNameKey(item) === key);
		if (restored) removed = removed.filter((item) => membershipNameKey(item) !== key);
		entries.push({
			name: restored ?? name,
			initial: Boolean(restored),
			partial: false,
			applyToAll: true
		});
	}
	return { entries, removed };
}

export function removeMembershipName(draft: MembershipDraft, name: string): MembershipDraft {
	const key = membershipNameKey(name);
	const entry = draft.entries.find((item) => membershipNameKey(item.name) === key);
	if (!entry) return draft;
	return {
		entries: draft.entries.filter((item) => membershipNameKey(item.name) !== key),
		removed: entry.initial ? [...draft.removed, entry.name] : draft.removed
	};
}

export function membershipActionForName(draft: MembershipDraft, name: string): boolean | null {
	const key = membershipNameKey(name);
	if (draft.removed.some((item) => membershipNameKey(item) === key)) return false;
	if (draft.entries.some((entry) => entry.applyToAll && membershipNameKey(entry.name) === key))
		return true;
	return null;
}

export function applyTagMembership(current: string[], draft: MembershipDraft): string[] {
	const removed = new Set(draft.removed.map(membershipNameKey));
	const result = current.filter((name) => !removed.has(membershipNameKey(name)));
	const present = new Set(result.map(membershipNameKey));
	for (const entry of draft.entries) {
		const key = membershipNameKey(entry.name);
		if (!entry.applyToAll || present.has(key)) continue;
		result.push(entry.name);
		present.add(key);
	}
	return result;
}
