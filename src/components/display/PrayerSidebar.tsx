/** @deprecated Use PrayerTimesBar with variant="sidebar". */
import React from 'react';
import PrayerTimesBar, { type PrayerTimesBarProps } from './PrayerTimesBar';

const PrayerSidebar: React.FC<Omit<PrayerTimesBarProps, 'variant'>> = (props) => (
  <PrayerTimesBar variant="sidebar" {...props} />
);

export default React.memo(PrayerSidebar);
