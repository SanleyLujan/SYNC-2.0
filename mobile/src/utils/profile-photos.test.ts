import { profileGallery, replaceGalleryPhoto } from './profile-photos';
it('keeps onboarding gallery order and falls back only when it is empty', () => {
  expect(profileGallery({ profilePhotos:['a','b','c'], avatarUrl:'avatar' })).toEqual(['a','b','c']);
  expect(profileGallery({ profilePhotos:[], avatarUrl:'avatar' })).toEqual(['avatar']);
  expect(profileGallery({ profilePhotos:['','a','a'] })).toEqual(['a']);
});
it('replaces a gallery photo without altering the other images', () => {
  expect(replaceGalleryPhoto(['a','b','c'],1,'d')).toEqual(['a','d','c']);
  expect(replaceGalleryPhoto(['a','b','c'],null,'d')).toEqual(['a','b','c','d']);
  expect(replaceGalleryPhoto(['a','b','c','d','e'],null,'f')).toHaveLength(5);
});
