import { useEffect, useState } from 'react';

/**
  Custom hook for debouncing search input. It delays the update of the search value until the user stops typing.
 
  This hook can be useful in scenarios where you want to wait for the user to finish typing before triggering
  a search or API request, preventing unnecessary re-renders or requests on every keystroke.
 
  @param {string} search - The current search term or query.
  @param {number} [delay=300] - The debounce delay in milliseconds. Defaults to 300ms.
  
  @returns {string} The debounced search term that updates after the specified delay.
  
  @example
  const debouncedSearch = useDebouncedSearch(searchQuery, 500);
  // `debouncedSearch` will only update after 500ms of inactivity.
 */
export const useDebouncedSearch = (search: string, delay: number = 300) => {
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    // Create a timeout handler to update the debounced search value after the specified delay
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, delay);

    // Cleanup function to clear the timeout when the component unmounts or when search/debounce delay changes
    return () => {
      clearTimeout(handler);
    };
  }, [search, delay]);

  return debouncedSearch;
};

export default useDebouncedSearch;

