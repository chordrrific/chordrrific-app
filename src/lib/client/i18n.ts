import { writable } from 'svelte/store';

export type Locale = 'es' | 'en';
export const locale = writable<Locale>('es');

export function initLocale(): void {
	const saved = localStorage.getItem('chordrrific-locale');
	setLocale(
		saved === 'es' || saved === 'en' ? saved : navigator.language.startsWith('es') ? 'es' : 'en'
	);
}

export function setLocale(value: Locale): void {
	locale.set(value);
	if (typeof document !== 'undefined') document.documentElement.lang = value;
	if (typeof localStorage !== 'undefined') localStorage.setItem('chordrrific-locale', value);
}

const strings = {
	es: {
		brand: 'Chordrrific',
		songs: 'Canciones',
		collections: 'Colecciones',
		tags: 'Etiquetas',
		admin: 'Usuarios',
		settings: 'Cuenta',
		signIn: 'Entrar',
		signOut: 'Salir',
		email: 'Correo',
		password: 'Contraseña',
		currentPassword: 'Contraseña actual',
		newPassword: 'Contraseña nueva',
		changePassword: 'Cambiar contraseña',
		save: 'Guardar',
		cancel: 'Cancelar',
		delete: 'Eliminar',
		create: 'Crear',
		edit: 'Editar',
		view: 'Ver',
		title: 'Título',
		content: 'Contenido ChordPro',
		name: 'Nombre',
		search: 'Buscar por título',
		allCollections: 'Todas las colecciones',
		allTags: 'Todas las etiquetas',
		newSong: 'Nueva canción',
		newCollection: 'Nueva colección',
		newTag: 'Nueva etiqueta',
		newUser: 'Nuevo usuario',
		noSongs: 'Todavía no hay canciones.',
		noCollections: 'Todavía no hay colecciones.',
		noTags: 'Todavía no hay etiquetas.',
		noUsers: 'Todavía no hay usuarios.',
		preview: 'Vista previa',
		notation: 'Notación',
		transpose: 'Transponer',
		letters: 'Letras',
		solfege: 'Solfeo',
		nashville: 'Nashville',
		keyNeeded: 'Añade {key: ...} para usar Nashville.',
		addSong: 'Añadir canción',
		remove: 'Quitar',
		up: 'Subir',
		down: 'Bajar',
		adminRole: 'Administrador',
		resetPassword: 'Cambiar contraseña',
		confirmDelete: '¿Seguro que quieres eliminarlo?',
		saved: 'Guardado.',
		privateLibrary: 'Tu cancionero privado',
		intro: 'Guarda, organiza y visualiza tus canciones en ChordPro.',
		selectSong: 'Selecciona una canción para verla o editarla.',
		loginFailed: 'No se pudo iniciar sesión.',
		passwordChanged: 'Contraseña cambiada. Vuelve a entrar.',
		loading: 'Cargando…',
		collectionSongs: 'Canciones ordenadas',
		chooseSong: 'Elige una canción',
		manageTags: 'Etiquetas de la canción',
		manageCollections: 'Colecciones de la canción'
	},
	en: {
		brand: 'Chordrrific',
		songs: 'Songs',
		collections: 'Collections',
		tags: 'Tags',
		admin: 'Users',
		settings: 'Account',
		signIn: 'Sign in',
		signOut: 'Sign out',
		email: 'Email',
		password: 'Password',
		currentPassword: 'Current password',
		newPassword: 'New password',
		changePassword: 'Change password',
		save: 'Save',
		cancel: 'Cancel',
		delete: 'Delete',
		create: 'Create',
		edit: 'Edit',
		view: 'View',
		title: 'Title',
		content: 'ChordPro content',
		name: 'Name',
		search: 'Search by title',
		allCollections: 'All collections',
		allTags: 'All tags',
		newSong: 'New song',
		newCollection: 'New collection',
		newTag: 'New tag',
		newUser: 'New user',
		noSongs: 'No songs yet.',
		noCollections: 'No collections yet.',
		noTags: 'No tags yet.',
		noUsers: 'No users yet.',
		preview: 'Preview',
		notation: 'Notation',
		transpose: 'Transpose',
		letters: 'Letters',
		solfege: 'Solfege',
		nashville: 'Nashville',
		keyNeeded: 'Add {key: ...} to use Nashville.',
		addSong: 'Add song',
		remove: 'Remove',
		up: 'Move up',
		down: 'Move down',
		adminRole: 'Administrator',
		resetPassword: 'Change password',
		confirmDelete: 'Are you sure you want to delete it?',
		saved: 'Saved.',
		privateLibrary: 'Your private songbook',
		intro: 'Save, organize and view your songs in ChordPro.',
		selectSong: 'Select a song to view or edit it.',
		loginFailed: 'Could not sign in.',
		passwordChanged: 'Password changed. Sign in again.',
		loading: 'Loading…',
		collectionSongs: 'Ordered songs',
		chooseSong: 'Choose a song',
		manageTags: 'Song tags',
		manageCollections: 'Song collections'
	}
} as const;

export type TranslationKey = keyof typeof strings.es;
export function t(language: Locale, key: TranslationKey): string {
	return strings[language][key];
}
