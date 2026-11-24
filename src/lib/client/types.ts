export interface User {
	id: string;
	email: string;
	isAdmin: boolean;
	createdAt?: string;
}
export interface Tag {
	id: string;
	name: string;
}
export interface CollectionEntry {
	songId: string;
	position: number;
	song: { id: string; title: string };
}
export interface Collection {
	id: string;
	name: string;
	songs: CollectionEntry[];
}
export interface Song {
	id: string;
	title: string;
	content: string;
	tags: { tagId: string; tag: Tag }[];
	collections: { collectionId: string; collection: Collection }[];
}
