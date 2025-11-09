function decodeBase64(input: string): string {
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(input)
  }

  type MinimalBuffer = {
    from(value: string, encoding: string): { toString(encoding: string): string }
  }

  const maybeBuffer = (globalThis as { Buffer?: MinimalBuffer }).Buffer

  if (maybeBuffer) {
    return maybeBuffer.from(input, 'base64').toString('binary')
  }

  throw new Error('Base64 decoding is not supported in this environment.')
}

export function b64ToBlob(b64: string, mime: string = 'application/octet-stream'): Blob {
  const sanitized = b64.trim()
  if (sanitized.length === 0) {
    throw new Error('Cannot convert empty base64 string to Blob.')
  }

  const byteCharacters = decodeBase64(sanitized)
  const byteLength = byteCharacters.length
  const byteArray = new Uint8Array(byteLength)

  for (let index = 0; index < byteLength; index += 1) {
    byteArray[index] = byteCharacters.charCodeAt(index)
  }

  return new Blob([byteArray], { type: mime })
}

