import { createContext, ReactNode, useEffect, useState } from 'react';

import { THEME } from '../../constants';
import { Theme, ThemeContextType } from './Types';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [theme, setTheme] = useState<Theme>(
    (typeof window !== 'undefined' && (localStorage.getItem('theme') as Theme)) || THEME.LIGHT
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev: Theme) => (prev === THEME.DARK ? THEME.LIGHT : THEME.DARK));

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

export default ThemeContext;
