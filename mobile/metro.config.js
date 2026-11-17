const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Na web, importações diretas de 'react-native-maps' (não previstas pelo
// nosso wrapper) caem num shim vazio pra não quebrar o bundle.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return {
      filePath: path.resolve(__dirname, 'src/components/map/SyncMap.web.tsx'),
      type: 'sourceFile',
    };
  }
  const result = context.resolveRequest(context, moduleName, platform);
  if (platform === 'web' && result.type === 'sourceFile' &&
      result.filePath.replace(/\\/g, '/').endsWith('/expo-font/build/ExpoFontLoader.web.js')) {
    return { filePath: path.resolve(__dirname, 'src/shims/ExpoFontLoader.web.ts'), type: 'sourceFile' };
  }
  return result;
};

module.exports = config;
