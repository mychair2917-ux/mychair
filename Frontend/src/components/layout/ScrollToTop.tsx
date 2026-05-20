import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
  Scrolls the window to the top of the page on every route change.

  Utilizes React Router’s `useLocation` hook to track the current path,
  and a `useEffect` hook to automatically scroll the window to the top
  (coordinates 0, 0) whenever the pathname changes. This ensures a consistent
  scroll position when navigating between routes in a single-page application.

  Parameters:
  @param {void} - This component does not accept any parameters.

  Returns:
  @returns {null} - Returns null; this is a non-visual component with only side effects.

  Exception Handling:
  No explicit error handling; assumes `window.scrollTo` and `useLocation` will behave as expected.
*/

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
