import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';

type SidebarContextValue = {
  isSidebarOpen: boolean;
  isDesktop: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

const DESKTOP_MQ = '(min-width: 1024px)';

function getIsDesktop() {
  return typeof window !== 'undefined' ? window.matchMedia(DESKTOP_MQ).matches : true;
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [isDesktop, setIsDesktop] = useState(getIsDesktop);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => getIsDesktop());

  const openSidebar = useCallback(() => setIsSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setIsSidebarOpen((open) => !open), []);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_MQ);
    const handleChange = () => {
      const desktop = media.matches;
      setIsDesktop(desktop);
      setIsSidebarOpen(desktop);
    };

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname, isDesktop]);

  useEffect(() => {
    if (!isSidebarOpen || isDesktop) return;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [isSidebarOpen, isDesktop]);

  const value = useMemo(
    () => ({
      isSidebarOpen,
      isDesktop,
      openSidebar,
      closeSidebar,
      toggleSidebar,
    }),
    [isSidebarOpen, isDesktop, openSidebar, closeSidebar, toggleSidebar]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
}

export const SIDEBAR_WIDTH_EXPANDED = '18rem';
export const SIDEBAR_WIDTH_COLLAPSED = '4.5rem';
