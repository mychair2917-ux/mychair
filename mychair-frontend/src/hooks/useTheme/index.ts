import { useContext } from 'react';

import ThemeContext from '../../context/ThemeContext';
import { ThemeContextType } from '../../context/ThemeContext/Types';

const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default useTheme;
