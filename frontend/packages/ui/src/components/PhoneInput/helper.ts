// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — google-libphonenumber has no type declarations
import { PhoneNumberUtil } from 'google-libphonenumber';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const phoneUtil: any = PhoneNumberUtil.getInstance();

const onlyContainsNumbers = (number: string): boolean => {
  return /^\d+$/.test(number);
};

export const isValidPhoneNumber = (phoneNumber: string): boolean => {
  try {
    if (!phoneNumber || !onlyContainsNumbers(phoneNumber) || typeof phoneNumber !== 'string') {
      return false;
    }

    const phoneNumberParsed = phoneUtil.parseAndKeepRawInput(`+${phoneNumber}`, null);
    return phoneUtil.isValidNumber(phoneNumberParsed);
  } catch {
    return false;
  }
};

const isNumeric = (str: string): boolean => {
  if (!str) return false;
  return /^\d+$/.test(str);
};

export const getDeletionType = (
  inputType: string | undefined,
): 'forward' | 'backward' | undefined => {
  const isDeletion = inputType?.toLocaleLowerCase().includes('delete') ?? false;
  if (!isDeletion) return undefined;

  return inputType?.toLocaleLowerCase().includes('forward') ? 'forward' : 'backward';
};

interface CursorPositionParams {
  phoneBeforeInput: string;
  phoneAfterInput: string;
  phoneAfterFormatted: string;
  cursorPositionAfterInput: number;
  deletion: 'forward' | 'backward' | undefined;
}

export const getCursorPosition = ({
  phoneBeforeInput,
  phoneAfterInput,
  phoneAfterFormatted,
  cursorPositionAfterInput,
  deletion,
}: CursorPositionParams): number => {
  if (!phoneBeforeInput) {
    return phoneAfterFormatted.length;
  }

  let afterInputPointIndex: number | null = null;

  for (let index = cursorPositionAfterInput - 1; index >= 0; index -= 1) {
    if (isNumeric(phoneAfterInput[index])) {
      afterInputPointIndex = index;
      break;
    }
  }

  if (afterInputPointIndex === null) {
    for (let index = 0; index < phoneAfterInput.length; index += 1) {
      if (isNumeric(phoneAfterFormatted[index])) {
        return index;
      }
    }

    return phoneAfterInput.length;
  }

  let digitIndex = 0;
  for (let index = 0; index < afterInputPointIndex; index += 1) {
    if (isNumeric(phoneAfterInput[index])) {
      digitIndex += 1;
    }
  }

  let cursorPosition = 0;
  let digitsCounter = 0;
  for (let index = 0; index < phoneAfterFormatted.length; index += 1) {
    cursorPosition += 1;

    if (isNumeric(phoneAfterFormatted[index])) {
      digitsCounter += 1;
    }

    if (digitsCounter >= digitIndex + 1) {
      break;
    }
  }

  if (deletion !== 'backward') {
    while (
      !isNumeric(phoneAfterFormatted[cursorPosition]) &&
      cursorPosition < phoneAfterFormatted.length
    ) {
      cursorPosition += 1;
    }
  }

  return cursorPosition;
};

export const getFormattedPhoneNumber = (
  phoneNumber: string,
  formatter: string | undefined,
): string => {
  if (!formatter) {
    return phoneNumber;
  }

  let formattedStr = '';
  let strIndex = 0;

  for (let i = 0; i < formatter.length; i++) {
    const formatChar = formatter[i];

    if (formatChar === '-' || formatChar === ' ') {
      formattedStr += strIndex < phoneNumber.length ? formatChar : '';
    } else if (formatChar === '.') {
      formattedStr += strIndex < phoneNumber.length ? phoneNumber[strIndex++] : '';
    } else {
      formattedStr += formatChar;
    }
  }

  formattedStr += phoneNumber.slice(strIndex);

  return formattedStr.length > formatter.length ? phoneNumber : formattedStr;
};

export interface SplitPhoneNumber {
  /** ISO country, e.g. "US" (empty when unknown). */
  countryCode: string;
  /** e.g. "+1" (empty when unknown). */
  callingCode: string;
  /** The national number's digits, e.g. "5145550385". */
  nationalNumber: string;
}

/**
 * Split a stored number ("+1-514-555-0385") into what PhoneInput takes as its defaults. A number
 * without a country code, or one the library cannot parse, keeps its digits and no country.
 */
export const splitPhoneNumber = (
  value: string | null | undefined,
  fallbackCountry = 'US',
): SplitPhoneNumber => {
  const digits = (value ?? '').replace(/\D/g, '');
  if (!value || !digits) {
    return { countryCode: fallbackCountry, callingCode: '', nationalNumber: '' };
  }
  try {
    const parsed = phoneUtil.parse(value.trim().startsWith('+') ? value : `+${digits}`, null);
    return {
      countryCode: phoneUtil.getRegionCodeForNumber(parsed) ?? fallbackCountry,
      callingCode: `+${parsed.getCountryCode()}`,
      nationalNumber: String(parsed.getNationalNumber() ?? ''),
    };
  } catch {
    return { countryCode: fallbackCountry, callingCode: '', nationalNumber: digits };
  }
};
