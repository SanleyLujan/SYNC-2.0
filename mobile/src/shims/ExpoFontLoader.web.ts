// Web-only Expo Font adapter: FontFace loads the original bundled font assets
// without writing @font-face text into an inline <style> element.
type Resource = { uri: string; display?: FontDisplay };
const faces = new Map<string, FontFace>();
// React Native's DOM typings omit these standard browser methods.
const fontSet = () => document.fonts as FontFaceSet & {
  add(face: FontFace): FontFaceSet;
  delete(face: FontFace): boolean;
};
export default {
  getLoadedFonts: () => [...faces.keys()],
  isLoaded: (name: string) => faces.has(name),
  async loadAsync(name: string, resource: Resource) {
    if (typeof document === 'undefined') return;
    if (faces.has(name)) return;
    const face = new FontFace(name, `url(${JSON.stringify(resource.uri)})`, { display: resource.display || 'auto' });
    await face.load();
    fontSet().add(face);
    faces.set(name, face);
  },
  async unloadAsync(name: string) {
    const face = faces.get(name);
    if (face && typeof document !== 'undefined') fontSet().delete(face);
    faces.delete(name);
  },
  async unloadAllAsync() {
    if (typeof document !== 'undefined') for (const face of faces.values()) fontSet().delete(face);
    faces.clear();
  },
  getServerResources: () => [],
  resetServerContext: () => {},
};
