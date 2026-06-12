/**
 * Fixed congregational supplications shown at scheduled prayer moments.
 * Text is not admin-editable in v1 — sourced from authentic narrations.
 */

export interface HardcodedSupplication {
  id: string;
  /** Short label for dev tooling only */
  label: string;
  arabicText: string;
  transliteration: string;
  translation: string;
  reference: string;
  /** Long slides use slightly smaller type so the full text fits without scrolling. */
  compact?: boolean;
}

/**
 * Dua upon hearing the adhan — Sahih al-Bukhari 614, Sahih Muslim 383.
 */
export const POST_ADHAN_SUPPLICATION: HardcodedSupplication = {
  id: 'post-adhan',
  label: 'After Adhan',
  arabicText:
    'اللَّهُمَّ رَبَّ هَٰذِهِ الدَّعْوَةِ التَّامَّةِ، وَالصَّلَاةِ الْقَائِمَةِ، آتِ مُحَمَّدًا الْوَسِيلَةَ وَالْفَضِيلَةَ، وَابْعَثْهُ مَقَامًا مَحْمُودًا الَّذِي وَعَدْتَهُ',
  transliteration:
    "Allahumma Rabba hadhihi-d-da'wati-t-tammah, was-salati-l-qa'imah, ati Muhammadan al-wasilata wal-fadilah, wab'ath-hu maqaman mahmudan alladhi wa'adtah.",
  translation:
    'O Allah, Lord of this perfect call and established prayer, grant Muhammad the intercession and favour, and raise him to the honoured station You have promised him.',
  reference: 'Sahih al-Bukhari 614',
};

/**
 * Post-Fardh duʿās — rotated during the post-jamaat supplication window.
 * Recommended after each obligatory prayer (see Tirmidhi, Abu Umamah).
 */
export const POST_JAMAAT_SUPPLICATIONS: readonly HardcodedSupplication[] = [
  {
    id: 'post-jamaat-refuge',
    label: 'Refuge from punishment and trials',
    arabicText:
      'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عَذَابِ جَهَنَّمَ، وَمِنْ عَذَابِ الْقَبْرِ، وَمِنْ فِتْنَةِ الْمَحْيَا وَالْمَمَاتِ، وَمِنْ شَرِّ فِتْنَةِ الْمَسِيحِ الدَّجَّالِ',
    transliteration:
      "Allahumma inni a'udhu bika min 'adhabi jahannam, wa min 'adhabil-qabr, wa min fitnatil-mahya wal-mamat, wa min sharri fitnatil-masihid-dajjal.",
    translation:
      'O Allah, I seek refuge with You from the torment of Hell, from the torment of the grave, from the trials of life and death, and from the evil of the trial of the Dajjal.',
    reference: 'Sahih al-Bukhari',
  },
  {
    id: 'post-jamaat-remembrance',
    label: 'Help in remembrance and worship',
    arabicText:
      'اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ',
    transliteration:
      "Allahumma a'inni 'ala dhikrika wa shukrika wa husni 'ibadatik.",
    translation:
      'O Allah, help me to remember You, to give thanks to You, and to worship You in the best manner.',
    reference: 'Abu Dawud',
  },
  {
    id: 'post-jamaat-steadfastness',
    label: 'Steadfastness on the religion',
    arabicText: 'يَا مُقَلِّبَ الْقُلُوبِ ثَبِّتْ قَلْبِي عَلَى دِينِكَ',
    transliteration: "Ya Muqallibal-qulubi, thabbit qalbi 'ala dinik.",
    translation: 'O Turner of the hearts, make my heart steadfast upon Your religion.',
    reference: 'Tirmidhi',
  },
  {
    id: 'post-jamaat-tahlil',
    label: 'Proclaiming tawhid',
    compact: true,
    arabicText:
      'لَا إِلٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ، لَا إِلٰهَ إِلَّا اللَّهُ وَلَا نَعْبُدُ إِلَّا إِيَّاهُ، لَهُ النِّعْمَةُ وَلَهُ الْفَضْلُ وَلَهُ الثَّنَاءُ الْحَسَنُ، لَا إِلٰهَ إِلَّا اللَّهُ مُخْلِصِينَ لَهُ الدِّينَ وَلَوْ كَرِهَ الْكَافِرُونَ',
    transliteration:
      "La ilaha illallah, wahdahu la sharika lah. Lahul-mulku wa lahul-hamdu wa huwa 'ala kulli shay'in qadir. La hawla wa la quwwata illa billah. La ilaha illallah wa la na'budu illa iyyah, lahun-ni'matu wa lahul-fadl wa lahuth-thana'ul-hasan. La ilaha illallah, mukhlisina lahud-dina wa law karihal-kafirun.",
    translation:
      'None has the right to be worshipped but Allah alone; He has no partner. His is the dominion and His is the praise, and He is Able to do all things. There is no power and no might except by Allah. None has the right to be worshipped but Allah, and we worship none but Him. His is grace, bounty, and the most excellent praise. None has the right to be worshipped but Allah — sincere in religion to Him, even if the disbelievers dislike it.',
    reference: 'Hisnul Muslim 68',
  },
  {
    id: 'post-jamaat-hasanah',
    label: 'Good in this world and the Hereafter',
    arabicText:
      'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
    transliteration:
      "Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan waqina 'adhaban-nar.",
    translation:
      'Our Lord! Grant us good in this world and good in the Hereafter, and protect us from the torment of the Fire.',
    reference: "Qur'an 2:201",
  },
] as const;
