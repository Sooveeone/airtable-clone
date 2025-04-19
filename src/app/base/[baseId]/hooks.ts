import { useEffect, useState } from "react";

// Hook for tracking when to display loading indicator
export function useDelayedLoading(isLoading: boolean, delay = 500) {
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isLoading) {
      timeout = setTimeout(() => {
        setShowLoading(true);
      }, delay);
    } else {
      setShowLoading(false);
    }
    return () => clearTimeout(timeout);
  }, [isLoading, delay]);

  return showLoading;
}

// Hook for click outside detection
export function useOutsideClick(
  callback: () => void,
  excludeRefs: React.RefObject<Element | null>[] = []
) {
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      let isOutside = true;
      
      // Check if the click was inside any of the excluded refs
      for (const ref of excludeRefs) {
        if (ref?.current?.contains(e.target as Node)) {
          isOutside = false;
          break;
        }
      }
      
      if (isOutside) {
        callback();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [callback, excludeRefs]);
} 