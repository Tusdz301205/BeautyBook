import type { ImageSourcePropType } from 'react-native';

const art = {
  hair: require('../../assets/illustrations/hair.webp') as ImageSourcePropType,
  hairMen: require('../../assets/illustrations/hair-men.jpg') as ImageSourcePropType,
  hairRemoval: require('../../assets/illustrations/hair-removal.jpg') as ImageSourcePropType,
  nails: require('../../assets/illustrations/nails.webp') as ImageSourcePropType,
  gelPolish: require('../../assets/illustrations/gel-polish.jpg') as ImageSourcePropType,
  skin: require('../../assets/illustrations/skin.webp') as ImageSourcePropType,
  spa: require('../../assets/illustrations/spa.webp') as ImageSourcePropType,
};

export function categoryArt(name: string): ImageSourcePropType | null {
  const label = name.toLocaleLowerCase('vi-VN');
  if (/cắt tóc nam|tóc nam|barber|cạo râu|tỉa râu/.test(label)) return art.hairMen;
  if (/triệt lông|wax|ipl|laser hair/.test(label)) return art.hairRemoval;
  if (/sơn gel|gel polish|sơn móng/.test(label)) return art.gelPolish;
  if (/tóc|gội|hair/.test(label)) return art.hair;
  if (/móng|nail/.test(label)) return art.nails;
  if (/da|facial|skin/.test(label)) return art.skin;
  if (/spa|massage|thư giãn|body/.test(label)) return art.spa;
  return null;
}

export const heroArt = art.skin;
