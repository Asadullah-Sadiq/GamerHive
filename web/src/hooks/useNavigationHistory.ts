import { useState, useCallback, useRef } from 'react';
import { PageType } from '../types';

interface NavigationState {
  page: PageType;
  params?: any;
}

export const useNavigationHistory = () => {
  const [history, setHistory] = useState<NavigationState[]>([{ page: 'home' }]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const historyRef = useRef<NavigationState[]>([{ page: 'home' }]);
  const currentIndexRef = useRef(0);

  const navigate = useCallback((page: PageType, params?: any) => {
    const newState: NavigationState = { page, params };
    
    // If we're not at the end of history, remove future entries (like browser forward/back)
    const newHistory = historyRef.current.slice(0, currentIndexRef.current + 1);
    
    // Only add if it's different from current page
    const currentState = historyRef.current[currentIndexRef.current];
    if (currentState && currentState.page === page && JSON.stringify(currentState.params) === JSON.stringify(params)) {
      return currentState;
    }
    
    newHistory.push(newState);
    
    historyRef.current = newHistory;
    currentIndexRef.current = newHistory.length - 1;
    
    setHistory([...newHistory]);
    setCurrentIndex(newHistory.length - 1);
    
    return newState;
  }, []);

  const goBack = useCallback(() => {
    if (currentIndexRef.current > 0) {
      currentIndexRef.current -= 1;
      setCurrentIndex(currentIndexRef.current);
      return historyRef.current[currentIndexRef.current];
    }
    return null;
  }, []);

  const goForward = useCallback(() => {
    if (currentIndexRef.current < historyRef.current.length - 1) {
      currentIndexRef.current += 1;
      setCurrentIndex(currentIndexRef.current);
      return historyRef.current[currentIndexRef.current];
    }
    return null;
  }, []);

  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < history.length - 1;
  const currentState = history[currentIndex];

  return {
    navigate,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    currentState,
    history,
  };
};

