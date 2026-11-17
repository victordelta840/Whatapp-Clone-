export interface TextSegment {
  kind: 'text' | 'link';
  value: string;
  href?: string;
}

const URL_OR_CONTACT_PATTERN =
  /((?:https?:\/\/|mailto:|tel:)[^\s<>"']+)/gi;

export function parseSafeLinks(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  const regex = new RegExp(URL_OR_CONTACT_PATTERN.source, 'gi');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', value: text.slice(lastIndex, match.index) });
    }
    const raw = match[1] ?? '';
    const trimmed = raw.replace(/[.,!?;:)\]]+$/, '');
    const trailing = raw.slice(trimmed.length);

    if (isSafeHref(trimmed)) {
      segments.push({ kind: 'link', value: trimmed, href: trimmed });
    } else {
      segments.push({ kind: 'text', value: trimmed });
    }
    if (trailing) {
      segments.push({ kind: 'text', value: trailing });
    }
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', value: text.slice(lastIndex) });
  }
  return segments;
}

export function isSafeHref(url: string): boolean {
  const lower = url.trim().toLowerCase();
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:')
  );
}

export function isEmojiOnlyMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const stripped = trimmed.replace(/\s+/g, '');
  if (!stripped) return false;
  // Match 1 to 3 Unicode extended pictographic grapheme sequences
  const emojiRegex =
    /^(?:\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*){1,3}$/u;
  return emojiRegex.test(stripped);
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\- ()]/g, '_').slice(0, 120) || 'file';
}

export function extractLinks(text: string): string[] {
  return parseSafeLinks(text)
    .filter((seg): seg is TextSegment & { href: string } => seg.kind === 'link' && Boolean(seg.href))
    .map((seg) => seg.href);
}
