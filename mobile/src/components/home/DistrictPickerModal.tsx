import React, { useEffect, useState } from 'react';
import SelectListSheet from '../SelectListSheet';
import { branchesApi } from '../../api/branches';

const ALL_AREAS = 'Tất cả khu vực';

interface Props {
  visible: boolean;
  selectedDistrict: string;
  onSelect: (district: string) => void;
  onClose: () => void;
}

export default function DistrictPickerModal({ visible, selectedDistrict, onSelect, onClose }: Props) {
  const [districts, setDistricts] = useState<string[]>([ALL_AREAS]);

  useEffect(() => {
    let active = true;
    branchesApi.districts()
      .then((rows) => {
        if (!active) return;
        const names = [...new Set(rows.map((row) => row.name).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, 'vi'));
        setDistricts([ALL_AREAS, ...names]);
      })
      .catch(() => {
        setDistricts([ALL_AREAS]);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <SelectListSheet
      visible={visible}
      title="Chọn quận"
      options={districts}
      selectedValue={selectedDistrict}
      onSelect={onSelect}
      onClose={onClose}
      columns={2}
    />
  );
}
