export function excerpt(text: string, bytes = 1024) {
	let result = '';
	for (const character of text.replace(/\r\n/g, '\n').replace(/\0/g, '')) {
		if (Buffer.byteLength(result + character) > bytes) {
			break;
		}
		result += character;
	}
	return result;
}
