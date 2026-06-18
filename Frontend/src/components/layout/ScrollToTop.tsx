import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
  Scrolls the document to the top on every route change.
  The authenticated app shell uses the window/body as the primary scroll container.
*/

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
