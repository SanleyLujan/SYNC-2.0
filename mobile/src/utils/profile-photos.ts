export function profileGallery(user: { profilePhotos?: string[] | null; avatarUrl?: string | null }) {
  const photos = (user.profilePhotos || []).filter(photo => typeof photo === 'string' && photo.trim());
  return [...new Set(photos.length ? photos : user.avatarUrl ? [user.avatarUrl] : [])].slice(0, 5);
}

// Chat uses the same first photo as Discovery, then the avatar if an image fails.
export function profilePreviewPhoto(user: Parameters<typeof profileGallery>[0] | null, failed: string[] = []) {
  if (!user) return null;
  return [profileGallery(user)[0], user.avatarUrl].find(photo => photo && !failed.includes(photo)) || null;
}

export function replaceGalleryPhoto(photos: string[], index: number | null, photo: string) {
  if (index === null) return [...photos, photo].slice(0, 5);
  return photos.map((value, i) => i === index ? photo : value);
}

export async function resizeGalleryPhoto(uri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) { reject(new Error('Não foi possível preparar a foto.')); return; }
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      let result = canvas.toDataURL('image/jpeg', 0.7);
      if (result.length > 550000) result = canvas.toDataURL('image/jpeg', 0.4);
      resolve(result);
    };
    img.onerror = () => reject(new Error('Não foi possível abrir a foto.'));
    img.src = uri;
  });
}
