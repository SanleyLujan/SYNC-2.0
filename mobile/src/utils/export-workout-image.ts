import type Svg from 'react-native-svg';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { WORKOUT_IMAGE_WIDTH, WORKOUT_IMAGE_HEIGHT } from './workout-image';

export async function exportWorkoutImage(svg: Svg | null, _xml: string, filename: string): Promise<void> {
  if (!svg || !FileSystem.cacheDirectory) throw new Error('Prévia indisponível. Tente novamente.');
  if (!await Sharing.isAvailableAsync()) throw new Error('O compartilhamento de imagens não está disponível neste dispositivo.');
  const base64 = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Não foi possível gerar a imagem. Tente novamente.')), 15000);
    try {
      svg.toDataURL((data) => {
        clearTimeout(timeout);
        if (data) resolve(data);
        else reject(new Error('Não foi possível gerar a imagem.'));
      }, { width: WORKOUT_IMAGE_WIDTH, height: WORKOUT_IMAGE_HEIGHT });
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  try {
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
    await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Compartilhar imagem do treino' });
  } finally {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
}
