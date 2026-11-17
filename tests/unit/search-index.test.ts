import { describe, expect, it } from 'vitest';
import { extractPhonesFromVCardOrCsv } from '@/features/contacts/contacts.service';
import { buildPreviewText } from '@/features/messages/messages.service';

describe('contacts parsing & message previews', () => {
  it('extracts valid E.164 phone numbers from vCard and CSV payloads', () => {
    const vcf = `BEGIN:VCARD\nFN:Alex\nTEL;TYPE=CELL:+1 (415) 555-0199\nTEL:555-1234\nEND:VCARD\n+44 20 7946 0958`;
    expect(extractPhonesFromVCardOrCsv(vcf)).toEqual(['+14155550199', '+442079460958']);
  });

  it('builds bounded preview strings for text and media messages', () => {
    expect(buildPreviewText('text', '  Hello world  ')).toBe('Hello world');
    expect(buildPreviewText('image', null)).toBe('Photo');
    expect(buildPreviewText('voice', null)).toBe('Voice note');
    expect(buildPreviewText('document', null, 'proposal.pdf')).toBe('proposal.pdf');
  });
});
