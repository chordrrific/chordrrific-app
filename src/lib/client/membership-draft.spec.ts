import { describe, expect, it } from 'vitest';
import {
	addMembershipNames,
	applyTagMembership,
	createMembershipDraft,
	membershipActionForName,
	removeMembershipName
} from './membership-draft.js';

describe('editing memberships across songs', () => {
	it('shows shared and partial memberships without changing untouched songs', () => {
		const draft = createMembershipDraft([
			['Navidad', 'Ensayo'],
			['navidad', 'Directo']
		]);
		expect(draft.entries.map(({ name, partial }) => [name, partial])).toEqual([
			['Navidad', false],
			['Ensayo', true],
			['Directo', true]
		]);
		expect(applyTagMembership(['Navidad', 'Ensayo'], draft)).toEqual(['Navidad', 'Ensayo']);
		expect(applyTagMembership(['navidad', 'Directo'], draft)).toEqual(['navidad', 'Directo']);
	});

	it('removes a partial membership from every song and adds new names to every song', () => {
		const initial = createMembershipDraft([['Navidad', 'Ensayo'], ['Navidad']]);
		const draft = addMembershipNames(removeMembershipName(initial, 'Ensayo'), 'Directo');
		expect(applyTagMembership(['Navidad', 'Ensayo'], draft)).toEqual(['Navidad', 'Directo']);
		expect(applyTagMembership(['Navidad'], draft)).toEqual(['Navidad', 'Directo']);
	});

	it('promotes a partial name to all songs when it is entered again', () => {
		const initial = createMembershipDraft([['Navidad'], []]);
		const draft = addMembershipNames(initial, 'navidad');
		expect(draft.entries[0]?.partial).toBe(false);
		expect(applyTagMembership([], draft)).toEqual(['Navidad']);
	});

	it('re-adding a removed name applies it to the whole selection', () => {
		const initial = createMembershipDraft([['Ensayo'], []]);
		const removed = removeMembershipName(initial, 'Ensayo');
		const draft = addMembershipNames(removed, 'ensayo');
		expect(draft.removed).toEqual([]);
		expect(applyTagMembership([], draft)).toEqual(['Ensayo']);
	});

	it('leaves partial collections alone until they are added or removed explicitly', () => {
		const initial = createMembershipDraft([['Concierto'], []]);
		expect(membershipActionForName(initial, 'Concierto')).toBeNull();
		expect(membershipActionForName(addMembershipNames(initial, 'Concierto'), 'Concierto')).toBe(
			true
		);
		expect(membershipActionForName(removeMembershipName(initial, 'Concierto'), 'Concierto')).toBe(
			false
		);
	});
});
