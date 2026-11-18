import React, { useMemo, useEffect, useState, useRef } from 'react';

import classNames from 'classnames';

import { aliasCodes } from './aliasCodes';
import { DEFAULT_COUNTRY_LIST } from './constants';
import {
  isValidPhoneNumber,
  getFormattedPhoneNumber,
  getDeletionType,
  getCursorPosition,
} from './helper';
import { Text } from '../Text';

import type { CountryData } from './constants';

import styles from '../../styles/phone-input/index.module.css';
import inputModule from '../../styles/input/index.module.css';
import { InputWithAddon, TYPES } from '../Input';
import { ARROWICON, VARIANTS } from '../Button';
import { SelectMenu } from '../SelectMenu';

// Flags are SVG files from the `flag-icons` package (hoisted to the workspace root's
// node_modules), loaded lazily as URLs and shown as images
const FLAGS_DIR = '../../../../../node_modules/flag-icons/flags/4x3';
const flagUrls = import.meta.glob<string>(
  '../../../../../node_modules/flag-icons/flags/4x3/*.svg',
  { query: '?url', import: 'default' },
);
type FlagProps = { width?: string; height?: string; style?: React.CSSProperties };
const flagLoaders: Record<string, () => Promise<React.ComponentType<FlagProps>>> =
  Object.fromEntries(
    Object.entries(flagUrls).map(([path, load]) => [
      path,
      async () => {
        const src = await load();
        const Flag = ({ width, height, style }: FlagProps) => (
          <img src={src} width={width} height={height} style={style} alt="" />
        );
        return Flag;
      },
    ]),
  );

interface CountryDataFormatted extends CountryData {
  key: string;
  label: string;
  value: string;
  svg: React.ComponentType<{
    width: string;
    height: string;
    style?: React.CSSProperties;
  }> | null;
  icon: () => React.ReactNode;
}

interface PhoneChangeData {
  phoneNumber: string;
  formattedPhoneNumber: string;
  phoneNumberWithCallingCode: string;
  formattedPhoneNumberWithCallingCode: string;
  isValid: boolean;
}

interface PhoneInputProps {
  label?: string;
  defaultCountryCode?: string;
  defaultCallingCode?: string;
  defaultPhoneNumber?: string;
  invalidNumberErrorMessage?: string;
  disabled?: boolean;
  onPhoneChange?: (data: PhoneChangeData, event: React.ChangeEvent<HTMLInputElement>) => void;
  identifier?: string;
  /** Show the field as invalid (e.g. a server-side error) even when the number itself parses. */
  hasError?: boolean;
  inputStyles?: React.CSSProperties;
}

const countryList = DEFAULT_COUNTRY_LIST;
const countrySearchPlaceholder = 'Search a country or country code';

function PhoneInput(props: PhoneInputProps): React.ReactElement {
  const {
    defaultCountryCode = 'FR',
    defaultPhoneNumber = '',
    defaultCallingCode = '',
    invalidNumberErrorMessage = 'The phone number you entered is invalid.',
    disabled,
    onPhoneChange,
    label,
    identifier = 'phoneInput',
    hasError = false,
    inputStyles = {},
  } = props;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [svgs, setSvgs] = useState<Record<string, any>>({});
  const [selectedCountry, setSelectedCountry] = useState<Partial<CountryDataFormatted>>({});
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [isError, setIsError] = useState(false);

  const SelectedCountryIcon = selectedCountry.svg;
  const selectedCountryCallingCode = selectedCountry.calling_code;

  const previousSelectedCountryRef = useRef<Partial<CountryDataFormatted>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previousSelectedCountry = previousSelectedCountryRef.current;
    if (
      (previousSelectedCountry as Partial<CountryDataFormatted>).code &&
      selectedCountry.code &&
      (previousSelectedCountry as Partial<CountryDataFormatted>).code !== selectedCountry.code
    ) {
      validatePhoneNumber();
    }
    previousSelectedCountryRef.current = selectedCountry;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountry.code]);

  const countryListFormatted = useMemo((): CountryDataFormatted[] => {
    return countryList && Array.isArray(countryList)
      ? countryList.map((item) => {
          const SvgComponent = svgs[item.code];
          return {
            ...item,
            key: String(item.country_id),
            label: `${item.name} (${item.calling_code})`,
            value: item.code,
            name: item.name,
            calling_code: item.calling_code.replace(/\+/g, ''),
            svg: svgs[item.code],
            icon: () => {
              return SvgComponent ? <SvgComponent width="22" height="24" /> : null;
            },
          };
        })
      : [];
  }, [svgs]);

  const countryListShown = useMemo((): CountryDataFormatted[] => {
    return searchValue
      ? countryListFormatted.filter((country) =>
          country.label.toLowerCase().includes(searchValue.toLowerCase()),
        )
      : countryListFormatted;
  }, [countryListFormatted, searchValue]);

  useEffect(() => {
    if (
      (defaultCountryCode || defaultCallingCode) &&
      !selectedCountry.key &&
      countryListFormatted.length
    ) {
      const sanitizedCallingCode = defaultCallingCode?.replace(/^\+/, '');

      const matchesBoth = (country: CountryDataFormatted): boolean =>
        country.calling_code === sanitizedCallingCode && country.code === defaultCountryCode;

      const matchesCallingCode = (country: CountryDataFormatted): boolean =>
        country.calling_code === sanitizedCallingCode;

      const matchesCountryCode = (country: CountryDataFormatted): boolean =>
        country.code === defaultCountryCode;

      let foundCountry =
        countryListFormatted.find(matchesBoth) ||
        countryListFormatted.find(matchesCallingCode) ||
        countryListFormatted.find(matchesCountryCode);

      if (!foundCountry) {
        foundCountry = countryListFormatted.find((country) => country.code === 'FR');
      }
      if (foundCountry?.svg) {
        setSelectedCountry(foundCountry);

        const phone = defaultPhoneNumber
          ? `${foundCountry.calling_code} ${getFormattedPhoneNumber(
              defaultPhoneNumber,
              foundCountry.formatter,
            )}`
          : `${foundCountry.calling_code} `;

        setPhoneNumber(phone);
      }
    }
  }, [
    defaultCountryCode,
    defaultCallingCode,
    defaultPhoneNumber,
    countryListFormatted,
    selectedCountry,
    svgs,
  ]);

  useEffect(() => {
    const loadSvgs = async (): Promise<void> => {
      const svgPromises = countryList.map(async (item) => {
        const originalCode = aliasCodes[item.code.toUpperCase()];
        const countryCode = originalCode ?? item.code;
        try {
          setFlagsLoading(true);
          const loadFlag = flagLoaders[`${FLAGS_DIR}/${countryCode.toLowerCase()}.svg`];
          const SvgComponent = loadFlag ? await loadFlag() : null;
          return { code: item.code, SvgComponent };
        } catch {
          return { code: item.code, SvgComponent: null };
        }
      });

      const loadedSvgs = await Promise.all(svgPromises);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const svgsMap = loadedSvgs.reduce<Record<string, any>>((acc, { code, SvgComponent }) => {
        acc[code] = SvgComponent;
        return acc;
      }, {});
      setFlagsLoading(false);
      setSvgs(svgsMap);
    };

    if (countryList && countryList.length) {
      loadSvgs();
    }
  }, []);

  const handleSearch = (value: string): void => {
    setSearchValue(value);
  };

  const handleCountrySelect = (event: React.SyntheticEvent, option: CountryDataFormatted): void => {
    if (isError) {
      setIsError(false);
    }
    const { calling_code: newCountryCallingCode, formatter } = option;
    setSelectedCountry(option);

    if (phoneNumber) {
      const phoneNumberNonFormatted = phoneNumber.replace(/\D/g, '');

      const phoneNumberWithoutCallingCode = phoneNumberNonFormatted.startsWith(
        selectedCountryCallingCode ?? '',
      )
        ? phoneNumberNonFormatted.substring((selectedCountryCallingCode ?? '').length)
        : phoneNumberNonFormatted;
      const formatted = getFormattedPhoneNumber(phoneNumberWithoutCallingCode, formatter);

      const phoneNumberWithCallingCode = `+${newCountryCallingCode}${phoneNumberWithoutCallingCode}`;
      const formattedPhoneNumberWithCallingCode = `+${newCountryCallingCode} ${formatted}`;
      setPhoneNumber(`${newCountryCallingCode} ${formatted}`);
      if (onPhoneChange) {
        onPhoneChange(
          {
            phoneNumber: phoneNumberWithoutCallingCode,
            formattedPhoneNumber: phoneNumberWithoutCallingCode,
            phoneNumberWithCallingCode,
            formattedPhoneNumberWithCallingCode,
            isValid: isValidPhoneNumber(
              phoneNumberWithCallingCode ? phoneNumberWithCallingCode.replace(/\D/g, '') : '',
            ),
          },
          event as React.ChangeEvent<HTMLInputElement>,
        );
      }
    } else {
      setPhoneNumber(`${newCountryCallingCode} `);
      if (onPhoneChange) {
        onPhoneChange(
          {
            phoneNumber: '',
            formattedPhoneNumber: '',
            phoneNumberWithCallingCode: newCountryCallingCode,
            formattedPhoneNumberWithCallingCode: newCountryCallingCode,
            isValid: isValidPhoneNumber(
              newCountryCallingCode ? newCountryCallingCode.replace(/\D/g, '') : '',
            ),
          },
          event as React.ChangeEvent<HTMLInputElement>,
        );
      }
    }
  };

  const handlePhoneNumberChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    if (isError) {
      setIsError(false);
    }

    const eventValue = event.target.value;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastTypedChar = (event.nativeEvent as any)?.data;
    let currentSelectedCountry: Partial<CountryDataFormatted> = selectedCountry;

    let inputNumber = (eventValue.match(/\d/g) ?? []).join('');

    if (!lastTypedChar && eventValue === `+${currentSelectedCountry.calling_code}`) {
      inputNumber = inputNumber.slice(0, -1);
    }

    let updatedCountry = countryListFormatted.find((currentCountry) => {
      return currentCountry.calling_code === inputNumber;
    });
    if (!updatedCountry) {
      updatedCountry = countryListFormatted.find((currentCountry) => {
        return inputNumber.startsWith(currentCountry.calling_code) && inputNumber.length <= 4;
      });
    }
    if (updatedCountry && updatedCountry.calling_code !== selectedCountryCallingCode) {
      currentSelectedCountry = updatedCountry;
      setSelectedCountry(updatedCountry);
    }

    const { calling_code: currentSelectedCountryCallingCode = '', formatter } =
      currentSelectedCountry;

    const inputNumberWithoutCallingCode = inputNumber.startsWith(currentSelectedCountryCallingCode)
      ? inputNumber.substring(currentSelectedCountryCallingCode.length)
      : inputNumber;

    if (!inputNumberWithoutCallingCode.length) {
      setPhoneNumber(
        `${inputNumber}${inputNumber === currentSelectedCountryCallingCode ? ' ' : ''}`,
      );
      if (onPhoneChange) {
        onPhoneChange(
          {
            phoneNumber: '',
            formattedPhoneNumber: '',
            phoneNumberWithCallingCode: `+${currentSelectedCountryCallingCode}`,
            formattedPhoneNumberWithCallingCode: `+${currentSelectedCountryCallingCode}`,
            isValid: false,
          },
          event,
        );
      }
      return;
    }

    const noCountryCodeFoundFlag = inputNumber === inputNumberWithoutCallingCode;

    const formattedPhoneNumber = noCountryCodeFoundFlag
      ? inputNumber
      : getFormattedPhoneNumber(inputNumberWithoutCallingCode, formatter);
    const phoneNumberWithCallingCode = `+${currentSelectedCountryCallingCode}${inputNumberWithoutCallingCode}`;
    const formattedPhoneNumberWithCallingCode = `+${currentSelectedCountryCallingCode} ${formattedPhoneNumber}`;
    const previousPhoneNumber = phoneNumber;
    setPhoneNumber(
      `${
        noCountryCodeFoundFlag ? '' : `${currentSelectedCountryCallingCode} `
      }${formattedPhoneNumber}`,
    );
    if (onPhoneChange) {
      onPhoneChange(
        {
          phoneNumber: inputNumberWithoutCallingCode,
          formattedPhoneNumber,
          phoneNumberWithCallingCode,
          formattedPhoneNumberWithCallingCode,
          isValid: isValidPhoneNumber(
            phoneNumberWithCallingCode ? phoneNumberWithCallingCode.replace(/\D/g, '') : '',
          ),
        },
        event,
      );
    }

    const newCursorPosition = getCursorPosition({
      cursorPositionAfterInput: event.target.selectionStart ?? 0,
      phoneBeforeInput: previousPhoneNumber,
      phoneAfterInput: eventValue,
      phoneAfterFormatted: formattedPhoneNumberWithCallingCode,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deletion: getDeletionType((event.nativeEvent as any).inputType),
    });

    Promise.resolve().then(() => {
      inputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
    });
  };

  const validatePhoneNumber = (): void => {
    if (
      !phoneNumber ||
      countryListFormatted.find((country) => country.calling_code === phoneNumber.trim())
    ) {
      return;
    }
    if (!isValidPhoneNumber(phoneNumber ? phoneNumber.replace(/\D/g, '') : '')) {
      setIsError(true);
    } else {
      setIsError(false);
    }
  };

  const inputClass = classNames(
    styles['hl-phone-input__input'],
    styles['hl-phone-input__input--medium'],
  );

  const leftAddon = (
    <SelectMenu
      identifier={`${identifier}-select`}
      options={countryListShown}
      selectedKey={selectedCountry.key}
      onSelect={(option, event) => {
        const country = countryListFormatted.find((c) => c.key === option.key);
        if (country) handleCountrySelect(event, country);
      }}
      searchValue={searchValue}
      handleSearch={handleSearch}
      searchPlaceholder={countrySearchPlaceholder}
      noOptionContent={
        <Text
          tag="p"
          size="sm"
          color="var(--hl-muted-foreground)"
          className={styles['hl-phone-input-no-results']}
        >
          No results found
        </Text>
      }
      disabled={disabled}
      controlButtonMetaData={{
        ariaLabel: 'Select country',
        icon: () =>
          !flagsLoading && SelectedCountryIcon ? (
            <SelectedCountryIcon
              width="22"
              height="16"
              style={{ boxShadow: 'var(--hl-shadow-xs)' }}
            />
          ) : null,
        loading: flagsLoading,
        arrowIcon: !flagsLoading ? ARROWICON.DOWN : undefined,
        iconAlone: !flagsLoading,
        variant: VARIANTS.TERTIARY,
        className: classNames(
          inputModule['hl-input__addon'],
          inputModule['hl-input__addon-left'],
          inputModule['hl-simple-select--trigger-left'],
          !flagsLoading && inputModule['hl-input__addon--iconAlone'],
        ),
      }}
    />
  );

  return (
    <div className={styles['hl-phone-input']}>
      <InputWithAddon
        label={label}
        type={TYPES.TEXT}
        onChange={handlePhoneNumberChange}
        value={`+${phoneNumber}`}
        leftAddon={leftAddon}
        id={identifier}
        onBlur={validatePhoneNumber}
        className={inputClass}
        ref={inputRef}
        isError={hasError || isError}
        validationText={invalidNumberErrorMessage}
        accessibleErrorText={invalidNumberErrorMessage}
        style={inputStyles}
        disabled={disabled}
      />
    </div>
  );
}

export default PhoneInput;
