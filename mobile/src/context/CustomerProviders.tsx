import React from 'react';
import { DistrictProvider, useDistrict } from './DistrictContext';
import { BookingsProvider } from './BookingsContext';
import { FavoritesProvider } from './FavoritesContext';
import { AddressProvider } from './AddressContext';
import { LanguageProvider, useLanguage } from './LanguageContext';
import DistrictPickerModal from '../components/home/DistrictPickerModal';
import SelectListSheet from '../components/SelectListSheet';
function Sheets() {
  const district = useDistrict(); const language = useLanguage();
  return <><DistrictPickerModal visible={district.isPickerVisible} selectedDistrict={district.selectedDistrict} onSelect={district.selectDistrict} onClose={district.closePicker} /><SelectListSheet visible={language.isLanguageSheetVisible} title="Ngôn ngữ" options={['Tiếng Việt (Việt Nam)']} selectedValue="Tiếng Việt (Việt Nam)" onSelect={language.closeLanguageSheet} onClose={language.closeLanguageSheet} columns={1} /></>;
}
export default function CustomerProviders({ children }: { children: React.ReactNode }) {
  return <DistrictProvider><BookingsProvider><FavoritesProvider><AddressProvider><LanguageProvider>{children}<Sheets /></LanguageProvider></AddressProvider></FavoritesProvider></BookingsProvider></DistrictProvider>;
}
