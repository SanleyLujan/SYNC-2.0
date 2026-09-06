// Conversão determinística da logo fornecida em ícones de instalação.
// Executar da raiz: node mobile/scripts/generate-app-icons.js
// Requer as dependências do backend instaladas (sharp já faz parte do projeto).
const sharp = require('../../backend/node_modules/sharp');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'src/assets/images/app-icon-source.png');

async function main() {
  // Remove apenas as margens pretas da imagem vertical; preserva desenho e cor.
  const logo = await sharp(source)
    .trim({ background: '#000000', threshold: 8 })
    .png()
    .toBuffer();

  const outputs = [
    ['src/assets/images/icon.png', 1024, 0.8],
    ['src/assets/images/adaptive-icon.png', 1024, 0.6],
    ['public/icon-192.png', 192, 0.8],
    ['public/icon-512.png', 512, 0.8],
    ['public/icon-maskable-512.png', 512, 0.6],
    ['public/apple-touch-icon.png', 180, 0.8],
    ['public/favicon.png', 512, 0.8],
  ];

  for (const [file, size, fraction] of outputs) {
    const artwork = await sharp(logo)
      .resize(Math.round(size * fraction), Math.round(size * fraction), { fit: 'inside' })
      .toBuffer();
    await sharp({ create: { width: size, height: size, channels: 3, background: '#000000' } })
      .composite([{ input: artwork, gravity: 'centre' }])
      .png()
      .toFile(path.join(root, file));
    console.log(`${file}: ${size}x${size}`);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
