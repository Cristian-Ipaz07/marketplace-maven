import { useState, useEffect, useRef } from 'react';
import { fetchAndCacheImage } from '@/utils/imageCache';

export function useCachedImage(url: string | undefined | null) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const activeUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!url) {
      setObjectUrl(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const loadImage = async () => {
      const blob = await fetchAndCacheImage(url);
      
      if (!isMounted) return;
      
      if (blob) {
        const localUrl = URL.createObjectURL(blob);
        setObjectUrl(localUrl);
        activeUrlRef.current = localUrl;
      } else {
        // Fallback to original URL
        setObjectUrl(url);
      }
      setLoading(false);
    };

    loadImage();

    return () => {
      isMounted = false;
      if (activeUrlRef.current && activeUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(activeUrlRef.current);
      }
    };
  }, [url]);

  return { objectUrl: objectUrl || url || '', loading };
}
