// Download file names that are safe on Windows, macOS, iOS and Android:
// no path/reserved characters, no arrows or bidi control marks, no spaces (underscores instead).
const BAD = /[\\/:*?"<>|\u2190-\u21ff\u200e\u200f\u202a-\u202e\u2066-\u2069\u0000-\u001f]+/g

export function safeFileName(name, fallback = 'nutriaa') {
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 && /^\.[a-z0-9]{1,5}$/i.test(name.slice(dot)) ? name.slice(dot).toLowerCase() : ''
  const base = (ext ? name.slice(0, dot) : name)
    .replace(BAD, '_')
    .replace(/\s+/g, '_')
    .replace(/_*-_*/g, '-')
    .replace(/_{2,}/g, '_')
    .replace(/^[_.-]+|[_.-]+$/g, '')
  return (base || fallback).slice(0, 120) + ext
}
