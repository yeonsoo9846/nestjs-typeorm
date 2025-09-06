import CryptoJS from 'crypto-js';

const secretKey = process.env.NEXT_PUBLIC_CRYPTO_SECRET || '';

export const encryption = (string: string) => {
  try {
    return CryptoJS.AES.encrypt(string, secretKey).toString();
  } catch (error) {
    return '';
  }
};

export const decryption = (string: string) => {
  try {
    const bytes = CryptoJS.AES.decrypt(string || '', secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
};
