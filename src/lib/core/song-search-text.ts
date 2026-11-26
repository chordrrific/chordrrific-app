const directiveWithValue = /^[ \t]*\{[a-z_][a-z0-9_]*(?:\s*:\s*|\s+)([^}\r\n]*)\}[ \t]*$/i;
const directiveLine = /^[ \t]*\{[a-z_][a-z0-9_]*(?:[^}\r\n]*)\}[ \t]*$/i;
const inlineChord = /\[[^\]\r\n]*\]/g;

export function songSearchText(content: string): { metadata: string[]; lyrics: string } {
	const metadata: string[] = [];
	const lyrics: string[] = [];
	for (const line of content.split(/\r?\n/)) {
		const directive = directiveWithValue.exec(line);
		if (directive) {
			const value = directive[1].trim();
			if (value) metadata.push(value);
			continue;
		}
		if (directiveLine.test(line)) continue;
		lyrics.push(line.replace(inlineChord, ''));
	}
	return { metadata, lyrics: lyrics.join('\n') };
}
