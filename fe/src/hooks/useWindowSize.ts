import { useState, useEffect } from 'react';

interface WindowSize {
  width: number;
  height: number;
}

export function useWindowSize(): WindowSize {
  const [windowSize, setWindowSize] = useState<WindowSize>({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener('resize', handleResize);
    // Cleanup function để gỡ bỏ event listener khi component unmount
    return () => window.removeEventListener('resize', handleResize);
  }, []); // Mảng rỗng đảm bảo effect này chỉ chạy một lần lúc mount

  return windowSize;
}