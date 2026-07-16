import { useLocation } from 'react-router';

/**
 Custom hook to extract specific query parameters from the current URL.
 
 Uses React Router's `useLocation` to read the current URL and retrieves values
 for the given query parameter keys.
 
 @function useURL
 
 @param {string[]} keys - An array of query parameter keys to retrieve from the URL.
 
 @returns {Record<string, string | null>} - An object where each key maps to the corresponding
   query parameter value or `null` if not found.
 
 Usage:
 - Call this hook inside a component to get values of specific URL query parameters.
 - Useful for reading filters, tokens, or IDs from the URL.
 
 Example:
 ```ts
 const { token, userId } = useURL(['token', 'userId']);
 ```
 
 Features:
 - Automatically updates when the URL changes.
 - Simple interface for accessing query parameters by key.
*/

function useURL(keys: string[]): Record<string, string | null> {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  const queryValues: Record<string, string | null> = {};

  keys.forEach((key) => {
    queryValues[key] = searchParams.get(key);
  });

  return queryValues;
}

export default useURL;
