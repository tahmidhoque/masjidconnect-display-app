/** @deprecated Use PrayerTimesBar with variant="strip". */
import React from 'react';
import PrayerTimesBar, { type PrayerTimesBarProps } from './PrayerTimesBar';

const PrayerStrip: React.FC<Omit<PrayerTimesBarProps, 'variant'>> = (props) => (
  <PrayerTimesBar variant="strip" {...props} />
);

export default React.memo(PrayerStrip);
