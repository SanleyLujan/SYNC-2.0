import { profileGallery, profilePreviewPhoto, replaceGalleryPhoto } from './profile-photos';
it('keeps onboarding gallery order and falls back only when it is empty', () => {
  expect(profileGallery({ profilePhotos:['a','b','c'], avatarUrl:'avatar' })).toEqual(['a','b','c']);
  expect(profileGallery({ profilePhotos:[], avatarUrl:'avatar' })).toEqual(['avatar']);
  expect(profileGallery({ profilePhotos:['','a','a'] })).toEqual(['a']);
});
it('uses the first Discovery photo in the chat even when an avatar exists', () => {
  expect(profilePreviewPhoto({ profilePhotos: ['first', 'second'], avatarUrl: 'avatar' })).toBe('first');
  expect(profilePreviewPhoto({ profilePhotos: ['second', 'first'], avatarUrl: 'avatar' })).toBe('second');
});
it('falls back to the avatar when there is no gallery or the first photo fails', () => {
  expect(profilePreviewPhoto({ profilePhotos: [], avatarUrl: 'avatar' })).toBe('avatar');
  expect(profilePreviewPhoto({ profilePhotos: ['first'], avatarUrl: 'avatar' }, ['first'])).toBe('avatar');
});
it('allows the chat initial fallback for unavailable or broken photos', () => {
  expect(profilePreviewPhoto(null)).toBeNull();
  expect(profilePreviewPhoto({ profilePhotos: [] })).toBeNull();
  expect(profilePreviewPhoto({ profilePhotos: ['first'], avatarUrl: 'avatar' }, ['first', 'avatar'])).toBeNull();
  expect(profilePreviewPhoto({ profilePhotos: ['same'], avatarUrl: 'same' }, ['same'])).toBeNull();
});
it('replaces a gallery photo without altering the other images', () => {
  expect(replaceGalleryPhoto(['a','b','c'],1,'d')).toEqual(['a','d','c']);
  expect(replaceGalleryPhoto(['a','b','c'],null,'d')).toEqual(['a','b','c','d']);
  expect(replaceGalleryPhoto(['a','b','c','d','e'],null,'f')).toHaveLength(5);
});
