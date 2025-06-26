import QRCode from 'qrcode';

export async function generateQRCode(text) {
  try {
    const dataUrl = await QRCode.toDataURL(text);
    return dataUrl;
  } catch (err) {
    console.error('QR Code generation failed:', err);
    return '';
  }
}

