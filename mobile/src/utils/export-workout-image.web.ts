import type Svg from 'react-native-svg';
import { WORKOUT_IMAGE_WIDTH, WORKOUT_IMAGE_HEIGHT } from './workout-image';

export async function exportWorkoutImage(_svg: Svg | null, xml: string, filename: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Não foi possível gerar a imagem.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = WORKOUT_IMAGE_WIDTH;
    canvas.height = WORKOUT_IMAGE_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Seu navegador não suporta a exportação de imagens.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Não foi possível gerar o PNG.')), 'image/png'));
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
