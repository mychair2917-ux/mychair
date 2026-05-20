import { JSX } from 'react';

type Nullable<T> = T | null | undefined;
/*** Converts a value that may be null or undefined to a chainable wrapper.* If the value is null or undefined, then Nothing is returned.* If the value is anything else, it is returned wrapped in a Just.** This wrapper supports chaining via `map`, and provides safe extraction methods* for both JSX (`getOrElse`) and primitive values (`getOrElseValue`).** @param value The value to wrap.* @returns An object with chainable methods for working with nullable values.*/ export function fromNullable<
  T,
>(value: Nullable<T>) {
  return {
    /*** Transforms the inner value if it exists.* @param fn A function that receives the inner value and returns a new value.* @returns A new wrapper containing the result, or Nothing if original was null/undefined. */ map<
      U,
    >(fn: (v: T) => U) {
      return fromNullable(value != null ? fn(value) : null);
    },
    /*** Returns the maybe value if it is nonempty.* Otherwise returns the result of evaluating `fn`.* Use this when working with JSX.** @param fn A function that returns a JSX.Element fallback.* @returns The current JSX value or the result of the fallback function.*/ getOrElse(
      fn: () => JSX.Element
    ): JSX.Element {
      return value != null ? (value as unknown as JSX.Element) : fn();
    },
    /*** Returns the maybe value if it is nonempty.* Otherwise returns the given fallback value.* Use this for primitive or non-JSX values.** @param fallback A raw value to use if current value is null/undefined.* @returns The current value or the fallback value.*/ getOrElseValue<
      U,
    >(fallback: U): T | U {
      return value != null ? value : fallback;
    },
  };
}
/*** Converts a value that may be empty, such as a string or an array, to a chainable wrapper.* It accepts anything that responds to `.length`. If the value is null, undefined, or has length 0,* then Nothing is returned. Otherwise, it is wrapped in a Just-like structure with map and getOrElse support.** @param data The value to wrap.* @returns An object with map, getOrElse, and getOrElseValue methods.*/ export function fromEmpty<
  T,
>(data: T | null | undefined) {
  /* eslint-disable */ const isEmpty = (d: any): boolean => {
    return (
      d === null ||
      d === undefined ||
      ((Array.isArray(d) || typeof d === 'string') && d.length === 0)
    );
  };
  return {
    /*** Transforms the inner value if it is not empty.* @param fn A function that receives the non-empty value and returns a new value.* @returns A new wrapped value or Nothing if empty.*/ map<
      U,
    >(fn: (val: T) => U) {
      return isEmpty(data) ? fromEmpty<U>(null) : fromEmpty(fn(data as T));
    },
    /*** Returns the JSX value if it exists.* Otherwise returns the result of evaluating `fn`.* Use this when rendering JSX elements.** @param fn A fallback function returning a JSX.Element.* @returns JSX.Element*/ getOrElse(
      fn: () => JSX.Element
    ): JSX.Element {
      return isEmpty(data) ? fn() : (data as unknown as JSX.Element);
    },
    /*** Returns the value if it is not empty.* Otherwise returns the given fallback value.* Use this for primitive or non-JSX types.** @param fallback A raw fallback value.* @returns The current value or the fallback.*/ getOrElseValue<
      U,
    >(fallback: U): T | U {
      return isEmpty(data) ? fallback : (data as T);
    },
  };
}
