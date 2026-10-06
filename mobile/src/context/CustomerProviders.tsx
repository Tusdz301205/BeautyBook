import React from 'react';
import { DistrictProvider, useDistrict } from './DistrictContext';
import { TimeFilterProvider, useTimeFilter } from './TimeFilterContext';
import { FilterProvider, useFilter } from './FilterContext';
import { BookingsProvider } from './BookingsContext';
import { FavoritesProvider } from './FavoritesContext';
import { AddressProvider } from './AddressContext';
import { LanguageProvider, useLanguage } from './LanguageContext';
import DistrictPickerModal from '../components/home/DistrictPickerModal';
import TimeFilterSheet from '../components/TimeFilterSheet';
import FilterSheet from '../components/FilterSheet';
import SelectListSheet from '../components/SelectListSheet';
function Sheets() {
  const district = useDistrict(); const time = useTimeFilter(); const filter = useFilter(); const language = useLanguage();
  return <><DistrictPickerModal visible={district.isPickerVisible} selectedDistrict={district.selectedDistrict} onSelect={district.selectDistrict} onClose={district.closePicker} /><TimeFilterSheet visible={time.isTimeSheetVisible} selected={time.timeFilter} customRange={time.customRange} onApply={time.applyTimeFilter} onClose={time.closeTimeSheet} /><FilterSheet visible={filter.isFilterSheetVisible} resultType={filter.resultType} onChangeResultType={filter.setResultType} onClose={filter.closeFilterSheet} onApply={filter.applySearchFilters} /><SelectListSheet visible={language.isLanguageSheetVisible} title="Ngôn ngữ" options={['Tiếng Việt (Việt Nam)']} selectedValue="Tiếng Việt (Việt Nam)" onSelect={language.closeLanguageSheet} onClose={language.closeLanguageSheet} columns={1} /></>;
}
export default function CustomerProviders({ children }: { children: React.ReactNode }) {
  return <DistrictProvider><TimeFilterProvider><FilterProvider><BookingsProvider><FavoritesProvider><AddressProvider><LanguageProvider>{children}<Sheets /></LanguageProvider></AddressProvider></FavoritesProvider></BookingsProvider></FilterProvider></TimeFilterProvider></DistrictProvider>;
}
