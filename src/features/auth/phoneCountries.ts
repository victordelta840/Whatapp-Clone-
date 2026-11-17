import { E164_REGEX } from '@/config/constants';

export interface PhoneCountry {
  iso: string;
  name: string;
  dialCode: string;
  flag: string;
  example: string;
}

export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { iso: 'US', name: 'United States', dialCode: '1', flag: '🇺🇸', example: '415 555 0123' },
  { iso: 'IN', name: 'India', dialCode: '91', flag: '🇮🇳', example: '98765 43210' },
  { iso: 'GB', name: 'United Kingdom', dialCode: '44', flag: '🇬🇧', example: '7700 900123' },
  { iso: 'CA', name: 'Canada', dialCode: '1', flag: '🇨🇦', example: '416 555 0198' },
  { iso: 'AU', name: 'Australia', dialCode: '61', flag: '🇦🇺', example: '412 345 678' },
  { iso: 'AE', name: 'United Arab Emirates', dialCode: '971', flag: '🇦🇪', example: '50 123 4567' },
  { iso: 'SA', name: 'Saudi Arabia', dialCode: '966', flag: '🇸🇦', example: '50 123 4567' },
  { iso: 'SG', name: 'Singapore', dialCode: '65', flag: '🇸🇬', example: '8123 4567' },
  { iso: 'DE', name: 'Germany', dialCode: '49', flag: '🇩🇪', example: '1512 3456789' },
  { iso: 'FR', name: 'France', dialCode: '33', flag: '🇫🇷', example: '6 12 34 56 78' },
  { iso: 'ES', name: 'Spain', dialCode: '34', flag: '🇪🇸', example: '612 34 56 78' },
  { iso: 'IT', name: 'Italy', dialCode: '39', flag: '🇮🇹', example: '312 345 6789' },
  { iso: 'NL', name: 'Netherlands', dialCode: '31', flag: '🇳🇱', example: '6 12345678' },
  { iso: 'BR', name: 'Brazil', dialCode: '55', flag: '🇧🇷', example: '11 91234 5678' },
  { iso: 'MX', name: 'Mexico', dialCode: '52', flag: '🇲🇽', example: '55 1234 5678' },
  { iso: 'NG', name: 'Nigeria', dialCode: '234', flag: '🇳🇬', example: '802 123 4567' },
  { iso: 'ZA', name: 'South Africa', dialCode: '27', flag: '🇿🇦', example: '82 123 4567' },
  { iso: 'KE', name: 'Kenya', dialCode: '254', flag: '🇰🇪', example: '712 345678' },
  { iso: 'EG', name: 'Egypt', dialCode: '20', flag: '🇪🇬', example: '100 123 4567' },
  { iso: 'PK', name: 'Pakistan', dialCode: '92', flag: '🇵🇰', example: '300 1234567' },
  { iso: 'BD', name: 'Bangladesh', dialCode: '880', flag: '🇧🇩', example: '1712 345678' },
  { iso: 'ID', name: 'Indonesia', dialCode: '62', flag: '🇮🇩', example: '812 3456 789' },
  { iso: 'MY', name: 'Malaysia', dialCode: '60', flag: '🇲🇾', example: '12 345 6789' },
  { iso: 'PH', name: 'Philippines', dialCode: '63', flag: '🇵🇭', example: '917 123 4567' },
  { iso: 'VN', name: 'Vietnam', dialCode: '84', flag: '🇻🇳', example: '91 234 56 78' },
  { iso: 'TH', name: 'Thailand', dialCode: '66', flag: '🇹🇭', example: '81 234 5678' },
  { iso: 'JP', name: 'Japan', dialCode: '81', flag: '🇯🇵', example: '90 1234 5678' },
  { iso: 'KR', name: 'South Korea', dialCode: '82', flag: '🇰🇷', example: '10 1234 5678' },
  { iso: 'TR', name: 'Turkey', dialCode: '90', flag: '🇹🇷', example: '532 123 45 67' },
  { iso: 'PL', name: 'Poland', dialCode: '48', flag: '🇵🇱', example: '501 234 567' },
  { iso: 'NZ', name: 'New Zealand', dialCode: '64', flag: '🇳🇿', example: '21 123 4567' },
  { iso: 'IE', name: 'Ireland', dialCode: '353', flag: '🇮🇪', example: '85 123 4567' },
] as const;

export function findCountryByDialCode(dialCode: string): PhoneCountry | undefined {
  const digits = dialCode.replace(/\D/g, '');
  if (!digits) return undefined;
  return PHONE_COUNTRIES.find((c) => c.dialCode === digits);
}

/**
 * Normalizes dial code + local phone input into strict E.164 format (+[country][subscriber]).
 * If the user pastes a full E.164 number starting with '+' into the phone field,
 * it respects that full E.164 number cleanly.
 */
export function normalizeToE164(dialCode: string, localNumber: string): string {
  const trimmedLocal = localNumber.trim();
  if (trimmedLocal.startsWith('+')) {
    return '+' + trimmedLocal.slice(1).replace(/\D/g, '');
  }
  const cleanDial = dialCode.replace(/\D/g, '');
  const cleanLocal = trimmedLocal.replace(/\D/g, '').replace(/^0+/, '');
  if (!cleanDial || !cleanLocal) return '';
  return `+${cleanDial}${cleanLocal}`;
}

export function isValidE164(value: string): boolean {
  return E164_REGEX.test(value);
}

export function formatReadablePhone(e164: string, dialCode?: string): string {
  if (!e164) return '';
  const digits = e164.replace(/\D/g, '');
  const code =
    dialCode?.replace(/\D/g, '') ||
    PHONE_COUNTRIES.find((c) => digits.startsWith(c.dialCode))?.dialCode;
  if (!code || !digits.startsWith(code)) return e164;
  const rest = digits.slice(code.length);
  if (code === '1' && rest.length === 10) {
    return `+1 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
  }
  if (code === '91' && rest.length === 10) {
    return `+91 ${rest.slice(0, 5)} ${rest.slice(5)}`;
  }
  const grouped = rest.replace(/(\d{3,4})(?=\d{3,})/g, '$1 ').trim();
  return `+${code} ${grouped}`;
}
