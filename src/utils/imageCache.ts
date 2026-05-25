import localforage from 'localforage';

localforage.config({
  name: 'MarketMaster',
  storeName: 'image_cache'
});

export const getCachedImageBlob = async (url: string): Promise<Blob | null> => {
  if (!url) return null;
  try {
    const blob = await localforage.getItem<Blob>(url);
    return blob;
  } catch (error) {
    console.error("Error reading from image cache", error);
    return null;
  }
};

export const cacheImageBlob = async (url: string, blob: Blob): Promise<void> => {
  if (!url || !blob) return;
  try {
    await localforage.setItem(url, blob);
  } catch (error) {
    console.error("Error writing to image cache", error);
  }
};

export const fetchAndCacheImage = async (url: string): Promise<Blob | null> => {
  try {
    const cached = await getCachedImageBlob(url);
    if (cached) return cached;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    
    await cacheImageBlob(url, blob);
    return blob;
  } catch (error) {
    console.error("Failed to fetch and cache image", url, error);
    return null;
  }
};

export const urlToBase64Cached = async (url: string): Promise<string> => {
  if (!url) return url;
  try {
    const blob = await fetchAndCacheImage(url);
    if (!blob) return url; // Fallback to URL if failed
    
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error converting image to base64", url, error);
    return url;
  }
};
