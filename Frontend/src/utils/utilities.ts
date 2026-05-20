import moment from 'moment-timezone';

import { MainOption, NestedOption } from '../components/common/CommentsPanel/NestedDropdown/types';
import { Chips } from '../components/common/Filter/Types';
import { CommentsApiResponse, DashboardQueryParams } from '../redux/slices/dashboard/Types';
import { SentimentQueryParams } from '../redux/slices/sentiment/Types';

/**
Converts a UTC timestamp to the user's local timezone with flexible formatting options.

Parameters:
@param {string | null | undefined} utcTime - The UTC time in ISO format (e.g., "2025-04-25T10:30:17.009Z").
@param {boolean} includeTime - Optional. If true, includes time in the output format.
@param {string} format - Optional. Custom format override.
                        If provided with includeTime=true, adds time component to the custom format.

Returns:
@returns {string} - Formatted local time string in specified format:
                   - Default date: "MM/DD/YYYY"
                   - With time: "MM/DD/YYYY, HH:mm:ss"
                   - Custom format if specified
                   - "---" for null/undefined inputs

Exception Handling:
- Returns "---" for null or undefined inputs
- Uses provided format as-is if it already contains time components
- Appends time component to custom format when includeTime=true
*/
export function convertUtcToLocal(
  utcTime: string | null | undefined,
  includeTime = false,
  format?: string
): string {
  if (!utcTime) {
    return '---';
  }

  const defaultDateFormat = 'MM/DD/YYYY';
  const defaultDateTimeFormat = 'MM/DD/YYYY, HH:mm:ss';
  const timeComponent = ', HH:mm:ss';

  // If custom format is provided
  if (format) {
    // Add time component to custom format if includeTime is true
    const finalFormat = includeTime && !format.includes('H') ? `${format}${timeComponent}` : format;
    return moment.utc(utcTime).local().format(finalFormat);
  }

  // Otherwise use default format based on includeTime flag
  return moment
    .utc(utcTime)
    .local()
    .format(includeTime ? defaultDateTimeFormat : defaultDateFormat);
}

/**
Converts seconds into a human-readable duration format.

Parameters:
@param {number | string | null | undefined} seconds - The duration in seconds to format.
                                                     Can be a number, numeric string, null, or undefined.

Returns:
@returns {string} - A formatted duration string (e.g., "12 Days 16 Hours 16 Minutes 47 Seconds")
                   or "---" for invalid/null/negative inputs.

Exception Handling:
- Returns "---" for null or undefined inputs
- Returns "---" for negative values
- Returns "---" for non-numeric strings
- Returns "0 sec" for zero duration
*/
export function formatElapsedTime(seconds: number | string | null | undefined): string {
  // Handle invalid inputs
  if (seconds === null || seconds === undefined) {
    return '---';
  }

  const totalSeconds = Number(seconds);

  // Handle invalid number conversions and negative values
  if (isNaN(totalSeconds) || totalSeconds < 0) {
    return '---';
  }

  // Handle zero case
  if (totalSeconds === 0) {
    return '0 Second';
  }

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = Math.floor(totalSeconds % 60);

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} ${days === 1 ? 'Day' : 'Days'}`);
  }
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'Hour' : 'Hours'}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? 'Minute' : 'Minutes'}`);
  }
  if (remainingSeconds > 0 || parts.length === 0) {
    parts.push(`${remainingSeconds} ${remainingSeconds === 1 ? 'Second' : 'Seconds'}`);
  }

  return parts.join(' ');
}

/**
  Formats a number into a human-readable string using compact notation (e.g., 1.2K, 3.5M, 1.1B),
  or returns the full number with commas based on the provided options.
 
  Parameters:
  @param {number | string} input - The number or numeric string to format.
  @param {Object} [options] - Optional configuration for formatting.
  @param {boolean} [options.compact=true] - Whether to use compact formatting. If false, returns the full number with commas.
  @param {number} [options.digits=1] - Number of decimal places to include in compact formatting.
 
  Returns:
  @returns {string} - The formatted number as a string.

  Exception Handling:
  None
 */

export function formatNumberCompact(
  input: number | string,
  options?: { compact?: boolean; digits?: number }
): string {
  const num = Number(input);
  if (isNaN(num)) return input.toString(); // Handles 'Unlimited' or non-numeric strings

  const { compact = true, digits = 1 } = options || {};

  if (!compact) {
    return num.toLocaleString('en-US');
  }

  const units = [
    { value: 1e9, symbol: 'B' },
    { value: 1e6, symbol: 'M' },
    { value: 1e3, symbol: 'K' },
  ];

  for (const unit of units) {
    if (num >= unit.value) {
      return (
        new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: digits,
        }).format(num / unit.value) + unit.symbol
      );
    }
  }

  return new Intl.NumberFormat('en-US').format(num);
}

/**
Validates a hybrid search query string containing Boolean operators and wildcards.

This function ensures that the provided search query:
- Does not contain invalid characters
- Has balanced and non-empty parentheses
- Does not include standalone or improperly placed wildcards (*, ?)
- Properly uses Boolean operators (AND, OR, NOT)
- Handles quoted phrases correctly (no unclosed quotes or empty strings)
- Does not start or end with operators, and avoids consecutive operators

Parameters:
@param {string} searchQuery – The search string entered by the user.

Returns:
@returns {boolean} – Returns `true` if the query is syntactically valid, otherwise `false`.

Exception Handling: 
None
*/
export const validateHybridSearch = (searchQuery: string): boolean => {
  // Trim whitespace
  const query = searchQuery.trim();

  // If empty string is provided, return false
  if (!query) return false;

  // Regular expressions
  const operatorRegex = /\b(AND|OR|NOT)\b/; // Match Boolean operators (AND, OR, NOT) in the query.
  const emptyParenthesesRegex = /\(\s*\)/; // Detect empty parentheses `()`
  const invalidCharsRegex = /[^a-zA-Z0-9\s"()*?]/; // Rejects anything except letters, numbers, spaces, " ( ) * ?
  const validWordRegex = /^(?![\s*?])[\w*?]+$/; // Allows letters, numbers, * and ? but not standalone
  const spaceBeforeWildcardRegex = /\s[?*]/; // Ensures * and ? are not preceded by spaces.
  const unclosedQuoteRegex = /"/g; // Matches all occurrences of `"`

  // Reject if query contains any disallowed special characters
  if (invalidCharsRegex.test(query)) return false;

  // Reject empty parentheses `()`
  if (emptyParenthesesRegex.test(query)) return false;

  // Reject standalone * or ?
  if (query === '*' || query === '?') return false;

  // Reject * or ? appearing immediately after a space
  if (spaceBeforeWildcardRegex.test(query)) return false;

  // Tokenize the string while preserving operators, quotes, and parentheses
  const tokens = query.match(/"[^"]*"|\(|\)|\b(?:AND|OR|NOT)\b|[^\s()"]+/g);
  if (!tokens) return false;

  // Reject unclosed quotes **
  const quoteMatches = query.match(unclosedQuoteRegex);
  if (quoteMatches && quoteMatches.length % 2 !== 0) return false; // Odd number of quotes = unclosed

  const stack: string[] = [];
  let lastToken: string | null = null;
  let expectingOperand = true;

  for (const token of tokens) {
    if (token === '(') {
      stack.push(token);
      expectingOperand = true;
    } else if (token === ')') {
      if (stack.length === 0 || stack[stack.length - 1] !== '(') return false;
      stack.pop();
      expectingOperand = false;
    } else if (operatorRegex.test(token)) {
      // If an operator is found at the start or after another operator, it's invalid
      if (expectingOperand) return false;
      expectingOperand = true; // After an operator, we expect an operand
    } else if (token.startsWith('"') && token.endsWith('"')) {
      // Ensure quoted phrase is not empty ("" is invalid)
      if (token.length === 2) return false;
      expectingOperand = false;
    } else {
      // Ensure words with * and ? are valid
      if (!validWordRegex.test(token)) return false;
      expectingOperand = false;
    }

    // Check for consecutive operators
    if (lastToken && operatorRegex.test(lastToken) && operatorRegex.test(token)) {
      return false;
    }
    lastToken = token;
  }

  // Ensure parentheses are balanced and we didn't end on an operator
  return stack.length === 0 && !expectingOperand;
};

/**
Converts a SNAKE_CASE string to Title Case format.

Parameters:
@param {string} input – The SNAKE_CASE string to be converted.

Returns:
@returns {string} – Returns the formatted Title Case string.

Exception Handling: 
None
*/
export const snakeToTitleCase = (input: string): string => {
  if (!input) return '---';

  return input
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
/** 

  Formats a date string into the format DD/MON/YYYY (e.g., 04/APR/2025).
  
  Converts an ISO date string into a human-readable format where the day is
  zero-padded, the month is a three-letter uppercase abbreviation, and the year is four digits.

  Parameters:
  @param {string} dateString - The ISO date string to format (e.g., '2025-04-04T12:04:09.391000').

  Returns:
  @returns {string} - The formatted date string in the format DD/MON/YYYY.

  Exception Handling:
  No explicit error handling; assumes `dateString` is a valid date string.
*/

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Formats a start and end date into 'MM/DD/YY' format (US locale).
 *
 * @param {string | Date} startDate - The start date.
 * @param {string | Date} endDate - The end date.
 * @returns {[string, string]} - A tuple containing the formatted start and end dates.
 */
export function formatDateRange(
  startDate: string | Date,
  endDate: string | Date
): [string, string] {
  const options: Intl.DateTimeFormatOptions = {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  };

  const start = new Date(startDate).toLocaleDateString('en-US', options);
  const end = new Date(endDate).toLocaleDateString('en-US', options);

  return [start, end];
}

/**
Formats a given date string to the start or end of the day in UTC, and returns it in ISO format.

Parameters:
@param {string | null | undefined} inputDate - The input date string to format. Can be null or undefined.
@param {'start' | 'end'} type - Determines whether to format to the start or end of the day.

Returns:
@returns {string} The ISO-formatted UTC date string, or an empty string if the input is invalid.

Exception Handling:
None
*/
export const formatDateToStartOrEndOfDay = (
  inputDate: string | null | undefined,
  type: 'start' | 'end'
): string => {
  if (!inputDate) return '';

  const parsed = moment(inputDate);

  if (!parsed.isValid()) return '';

  const adjusted = type === 'start' ? parsed.startOf('day').utc() : parsed.endOf('day').utc();

  return adjusted.toISOString();
};

/**
  Returns a new object without the specified keys.
 
  Parameters:
  @param filters - The original filters object.
  @param keys - An array of keys to remove from the filters object.
 
  Returns:
  @returns A new object with the specified keys removed.

  Exception Handling:
  None
 */
export const getFiltersWithoutKeys = <T extends object, K extends keyof T>(
  filters: T,
  keys: K[]
): Omit<T, K> => {
  const result = { ...filters };
  keys.forEach((key) => {
    delete result[key];
  });
  return result;
};

/**
  Calculates the percentage of a value relative to the total count.
 
  Parameters:
  @param {number} total - The total number.
  @param {number} value - The specific count to calculate the percentage for.
 
  Returns:
  @returns {string} The percentage value formatted and round off as a string.
  Returns '0' if the total is zero or less to avoid division by zero.

  Exception Handling:
  None
 */
export function percentage(total: number, value: number, decimal: number = 0): number {
  if (!Number.isFinite(total) || !Number.isFinite(value) || !Number.isFinite(decimal)) {
    throw new Error('percentage(): all arguments must be finite numbers');
  }
  if (total <= 0) {
    return 0;
  }
  const decimals = Math.max(0, Math.floor(decimal));
  const raw = (value / total) * 100;
  const factor = 10 ** decimals;
  return Math.round((raw + Number.EPSILON) * factor) / factor;
}

/**
  Formats a UTC date string or Date object into a custom string based on the provided format,
  after converting it explicitly to local time.

  Parameters:
  @param dateInput - A UTC date-time string (e.g., '2024-07-04T11:00:00Z') or a Date object.
  @param format - A format string using supported tokens like YYYY, MM, DD, hh, HH, mm, ss, MMM, and {A} (for AM/PM).

  Returns:
  @returns A string representing the input date in the local timezone, formatted according to the provided pattern.

  Exception Handling:
  Assumes valid date input. No internal exception is thrown. Returns formatted string based on system's local time.

  Supported Format Tokens:
  - YYYY: 4-digit year
  - YY: Last 2 digits of the year
  - MMM: Short month name (e.g., Jan, Feb)
  - MM: 2-digit month (01-12)
  - DD: 2-digit day (01-31)
  - HH: 24-hour format (00-23)
  - hh: 12-hour format (01-12)
  - mm: Minutes (00-59)
  - ss: Seconds (00-59)
  - {A}: AM/PM indicator

  Example:
  dateFormatter('2024-07-04T11:00:00Z', 'YYYY-MM-DD hh:mm:ss {A}');
  // Output (in IST): '2024-07-04 04:30:00 PM'
 */
export const dateFormatter = (dateInput: string | Date, format: string): string => {
  const date = moment.utc(dateInput).local(); // explicitly convert from UTC to local

  const hours24 = date.hour();
  const hours12 = hours24 % 12 || 12;
  const amPm = hours24 >= 12 ? 'PM' : 'AM';

  const monthNamesShort = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const tokens: { [key: string]: string } = {
    YYYY: String(date.year()),
    YY: String(date.year()).slice(-2),
    MMM: monthNamesShort[date.month()],
    MM: String(date.month() + 1).padStart(2, '0'),
    DD: String(date.date()).padStart(2, '0'),
    HH: String(hours24).padStart(2, '0'),
    hh: String(hours12).padStart(2, '0'),
    mm: String(date.minute()).padStart(2, '0'),
    ss: String(date.second()).padStart(2, '0'),
    '{A}': amPm,
  };

  return Object.entries(tokens)
    .sort((a, b) => b[0].length - a[0].length)
    .reduce((acc, [token, value]) => acc.replace(new RegExp(token, 'g'), value), format);
};

/**  
Returns the given value if it's not null, undefined, an empty string, or NaN. 
Otherwise, returns the fallback value.

Parameters:
@param {T | null | undefined} value – The value to validate and return if valid.
@param {string} fallback – The fallback to return if value is considered invalid. Defaults to '---'.

Returns:
@returns {T | string} – Returns the original value or the fallback.

Exception Handling: 
None
*/
export const withFallback = <T>(
  value: T | null | undefined,
  fallback: string = '---'
): T | string => {
  const isEmptyString = (val: unknown) => typeof val === 'string' && val.trim() === '';
  const isInvalidNumber = (val: unknown) => typeof val === 'number' && isNaN(val);

  if (value === null || value === undefined || isEmptyString(value) || isInvalidNumber(value)) {
    return fallback;
  }

  return value;
};

interface Chip {
  id: string;
  label: string;
}

export const convertPageFilterToChips = (
  pageFilter: DashboardQueryParams | SentimentQueryParams | undefined
): Chip[] => {
  if (!pageFilter) {
    return [];
  }

  // Keys to ignore
  const ignoredKeys = [
    'data_source_type',
    'query_id',
    'additional_filter',
    'search',
    'keywords',
    'phrases',
  ];

  // Special mappings for label and id
  const labelMappings = {
    start_date: 'Date',
    end_date: 'Date',
    sentiment: 'sentiment',
    unique_story_id: 'story',
    unique_id: 'unique id',
    keywords: 'Keywords',
    phrases: 'phrases',
    Categorization_Client_Category_Primary: 'Category',
  };

  const idMappings = {
    start_date: 'date',
    end_date: 'date',
    sentiment: 'sentiment',
    unique_story_id: 'unique_story_id',
    unique_id: 'unique_id',
    keywords: 'keywords',
    phrases: 'phrases',
    Categorization_Client_Category_Primary: 'Category',
  };

  const chips: Chip[] = [];

  // Process each key in pageFilter
  Object.keys(pageFilter).forEach((key) => {
    // Skip ignored keys
    if (ignoredKeys.includes(key)) {
      return;
    }

    // Skip if value is empty/null/undefined
    const value = pageFilter[key as keyof (DashboardQueryParams | SentimentQueryParams)];
    if (
      value === null ||
      value === undefined ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return;
    }

    // Check if we already have a chip with the same id (for start_date/end_date both mapping to 'date')
    const chipId = key in idMappings ? idMappings[key as keyof typeof idMappings] : key;
    const existingChip = chips.find((chip) => chip.id === chipId);

    if (!existingChip) {
      chips.push({
        id: chipId,
        label: labelMappings[key as keyof typeof labelMappings] || key,
      });
    }
  });

  return chips;
};

export const removePageFilter = (
  pageFilter: DashboardQueryParams | SentimentQueryParams,
  pageFilterChips: Chips[],
  chipId: string,
  setPageFilter: (filter: DashboardQueryParams | SentimentQueryParams) => void,
  setPageFilterChips: (chips: Chips[]) => void
): void => {
  // Find the chip to be removed
  const chipToRemove = pageFilterChips.find((chip) => chip.id === chipId);

  // If chip not found or label is "Date", do nothing
  if (!chipToRemove || chipToRemove.label === 'Date') {
    return;
  }

  // Remove the chip from pageFilterChips array
  const updatedChips = pageFilterChips.filter((chip) => chip.id !== chipId);
  setPageFilterChips(updatedChips);

  // Create a mapping to handle special cases for pageFilter keys
  const getPageFilterKeysToRemove = (chipId: string): string[] => {
    switch (chipId) {
      case 'date':
        return []; // Don't remove anything for date
      case 'unique_story_id':
        return ['unique_story_id'];
      case 'sentiment':
        return ['sentiment'];
      case 'keywords':
        return ['keywords'];
      case 'phrases':
        return ['phrases'];
      default:
        return [chipId]; // For other cases, use chipId as the key
    }
  };

  // Get the keys to remove from pageFilter
  const keysToRemove = getPageFilterKeysToRemove(chipId);

  // Create new pageFilter object without the specified keys
  const updatedPageFilter = { ...pageFilter };
  keysToRemove.forEach((key) => {
    delete updatedPageFilter[key as keyof (DashboardQueryParams | SentimentQueryParams)];
  });

  setPageFilter(updatedPageFilter);
};

/**
  Formats an input date string to MM/DD/YY or MM/DD/YYYY without altering its time zone.
 
  Parameters:
  @param dateStr - The input date string (with or without time zone).
  @param options - Optional settings.
  @param options.fullYear - If true, returns MM/DD/YYYY format. Otherwise, returns MM/DD/YY.

  Returns:
  @returns The formatted date string or '---' if invalid.

  Exception Handling:
  None
 */
export const formatShortDate = (
  dateStr?: string | null,
  options?: { fullYear?: boolean }
): string => {
  if (!dateStr) return '---';

  const parsed = moment.parseZone(dateStr);
  if (!parsed.isValid()) return '---';

  const format = options?.fullYear ? 'MM/DD/YYYY' : 'MM/DD/YY';
  return parsed.format(format);
};

/**
 * Formats a number as a percentage string without forcing unnecessary decimals.
 *
 * Behavior:
 * - If the number is an integer, it returns the number as-is (e.g., 100 → "100").
 * - If the number has decimals, it returns the number rounded to the specified decimal places (e.g., 33.333 → "33.33").
 *
 * Parameters:
 * @param num - The number to format.
 * @param decimals - The number of decimal places to keep (default: 2).
 *
 * Returns:
 * @returns A formatted string representation of the number without trailing ".00" for whole numbers.
 */
export function formatPercent(num: number, decimals: number = 2): string {
  return Number.isInteger(num) ? num.toString() : num.toFixed(decimals);
}

export function transformData(data: CommentsApiResponse): MainOption[] {
  const item: MainOption[] = [];
  const expandedOptions: NestedOption[] = [];
  data?.default.map((singleOption) => {
    const newItem: MainOption = {
      id: singleOption.columnKey,
      label: singleOption.column,
      dataType: singleOption.dataType,
      hasNested: false,
    };
    item.push(newItem);
  });
  data?.others.map((expandItem) => {
    const newItem: NestedOption = {
      id: expandItem.columnKey,
      label: expandItem.column,
      dataType: expandItem.dataType,
    };
    expandedOptions.push(newItem);
  });
  const expandingItem = {
    id: 'Other',
    label: 'Other',
    hasNested: true,
    nested: expandedOptions,
  };
  item.push(expandingItem);
  return item;
}

export const formatColumnName = (str: string) => {
  return str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Generates consistent colors for subjects with random distribution and special handling for "other".
 *
 * Behavior:
 * - Returns a special gray color for subjects named "other" or "others" (case insensitive).
 * - For regular subjects, assigns colors from a predefined palette of 10 colors with variations.
 * - Each subject name consistently gets the same color across renders.
 * - After 10 subjects, generates darker variations; after 20, generates lighter variations.
 * - Provides up to 30 unique color variations before cycling repeats.
 *
 * Parameters:
 * @param subjectName - The name of the subject to generate a color for.
 *
 * Returns:
 * @returns A hex color string (e.g., "#3B82F6") or HSL color string for the subject.
 */
export const getSubjectColor = (() => {
  // 10 predefined colors for subjects
  const subjectColors = [
    '#FF00D9',
    '#AF52DE',
    '#4D00FF',
    '#0D8BFD',
    '#30B0C7',
    '#00C7BE',
    '#C1E540',
    '#FC0',
    '#FF9500',
    '#FF2D84',
  ];

  // Special color for "other"
  const otherColor = '#6B7280'; // Gray

  // Keep track of assigned colors to ensure consistency
  const colorMap = new Map();
  let colorIndex = 0;

  return (subjectName: string) => {
    // Check if it's "other" (case insensitive)
    if (subjectName.toLowerCase() === 'other' || subjectName.toLowerCase() === 'others') {
      return otherColor;
    }

    // If we've already assigned a color to this subject, return it
    if (colorMap.has(subjectName)) {
      return colorMap.get(subjectName);
    }

    // Assign a new color (cycle through the array)
    const assignedColor = subjectColors[colorIndex % subjectColors.length];
    colorMap.set(subjectName, assignedColor);
    colorIndex++;

    return assignedColor;
  };
})();

/**
  Checks if an input date-time string has already occurred in local time (i.e., if it is expired).

  Parameters:
  @param expirationDate - The input date-time string representing the expiry (ISO format) or null/undefined.

  Returns:
  @returns `true` if the date-time has already passed (expired), otherwise `false`. Returns `false` for null, undefined, or empty string.

  Exception Handling:
  None
 */
export const isQueryExpired = (expirationDate?: string | null): boolean => {
  // Return false if no date is provided
  if (!expirationDate) return false;

  // Parse the date in local time
  const expiry = moment(expirationDate);

  // Check if it is already in the past
  return expiry.isBefore(moment());
};

/**
Validate if the given input string is valid JSON.
 
  Parameters:
  @param {input} - string: The raw input string (possibly with whitespace)
 
  Returns:
  @returns {boolean}: true if valid JSON, false otherwise

  Exception Handling:
  None
*/
const isValidJson = (input: string): boolean => {
  if (!input) return false;

  const trimmedInput = input.trim();

  try {
    JSON.parse(trimmedInput);
    return true;
  } catch (error) {
    return false;
  }
};

export default isValidJson;

/**
 Formats a datetime string by removing the time portion.

 This function takes a datetime string in the ISO format (e.g., "2025-12-09T18:30:00") 
 and returns only the date part (e.g., "2025-12-09"). If the input is null, undefined,
 or an empty string, it returns an empty string.

Parameters:
@param {string | null | undefined} datetimeString - The datetime string to format.

Returns:
@returns {string} - The date portion of the datetime string, or an empty string if input is invalid.

Exception Handling:
None
*/
export const formatDateRemoveTime = (datetimeString: string | null | undefined): string => {
  if (!datetimeString) return '';
  return datetimeString.split('T')[0];
};

/**
Formats input with automatic slash insertion
 
Parameters:
@param {string} value - The raw input string (may contain non-numeric characters).
 
Returns:
@returns {string} A formatted date string with slashes inserted (`MM`, `MM/DD`, or `MM/DD/YYYY`).

Exception Handling:
None
*/
export const formatInputWithSlashes = (value: string): string => {
  // Remove all non-numeric characters
  const numbers = value.replace(/\D/g, '');

  // Add slashes automatically
  if (numbers.length <= 2) {
    return numbers;
  } else if (numbers.length <= 4) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  } else {
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  }
};

// Helper function to build org-based paths
export const buildOrgPath = (orgId: string, basePath: string): string => {
  return `/orgs/${orgId}/${basePath}`;
};
