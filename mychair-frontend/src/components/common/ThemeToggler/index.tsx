import { THEME } from '../../../constants';
import { useTheme } from '../../../hooks';
import { cn } from '../../../utils/cn';
import { AngleDownIcon, NotificationIcon } from '../../Icons';

const ThemeToggler = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      {/* TODO: Remove these as added for testing purpose! */}
      <NotificationIcon color="red" size="2xl" viewBox="0 0 35 35" />
      <AngleDownIcon color="black" size="2xl" />
      <div className="rounded-lg bg-green-500 p-6 text-white shadow-md">
        <h1 className="text-2xl font-bold text-blue-500">Hello, Theming!</h1>
        <p className="text-red-300">This supports multiple themes dynamically!</p>
      </div>
      <button
        onClick={toggleTheme}
        className="flex items-center space-x-2 rounded-full border border-gray-300 bg-gray-200 p-2 text-gray-900 transition-all hover:bg-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
      >
        <div
          className={cn(
            'h-5 w-5 rounded-full transition-all',
            theme === THEME.DARK ? 'bg-yellow-400' : 'bg-gray-600 dark:bg-gray-300'
          )}
        />
        <span className="text-sm font-medium">
          {theme === THEME.DARK ? 'Light Mode' : 'Dark Mode'}
        </span>
      </button>
    </>
  );
};

export default ThemeToggler;
