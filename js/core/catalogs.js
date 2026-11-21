/**
 * AvyraCatalogs — Canonical catalogs mirroring Flutter's WorldCountries,
 * CurrencyCatalog, SudanLocations, UnionCategory, SquadCategory, plus
 * Multi-Country Regional/State Catalogs and Global Active Country Context.
 */
(function () {
  const CURRENCIES = [
    { code: 'SDG', nameAr: 'جنيه سوداني', nameEn: 'Sudanese Pound', symbol: 'ج.س' },
    { code: 'USD', nameAr: 'دولار أمريكي', nameEn: 'US Dollar', symbol: '$' },
    { code: 'EUR', nameAr: 'يورو', nameEn: 'Euro', symbol: '€' },
    { code: 'GBP', nameAr: 'جنيه إسترليني', nameEn: 'British Pound', symbol: '£' },
    { code: 'EGP', nameAr: 'جنيه مصري', nameEn: 'Egyptian Pound', symbol: 'ج.م' },
    { code: 'SAR', nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal', symbol: 'ر.س' },
    { code: 'AED', nameAr: 'درهم إماراتي', nameEn: 'UAE Dirham', symbol: 'د.إ' },
    { code: 'QAR', nameAr: 'ريال قطري', nameEn: 'Qatari Riyal', symbol: 'ر.ق' },
    { code: 'KWD', nameAr: 'دينار كويتي', nameEn: 'Kuwaiti Dinar', symbol: 'د.ك' },
    { code: 'BHD', nameAr: 'دينار بحريني', nameEn: 'Bahraini Dinar', symbol: 'د.ب' },
    { code: 'OMR', nameAr: 'ريال عماني', nameEn: 'Omani Rial', symbol: 'ر.ع' },
    { code: 'JOD', nameAr: 'دينار أردني', nameEn: 'Jordanian Dinar', symbol: 'د.أ' },
    { code: 'MAD', nameAr: 'درهم مغربي', nameEn: 'Moroccan Dirham', symbol: 'د.م' },
    { code: 'TND', nameAr: 'دينار تونسي', nameEn: 'Tunisian Dinar', symbol: 'د.ت' },
    { code: 'DZD', nameAr: 'دينار جزائري', nameEn: 'Algerian Dinar', symbol: 'د.ج' },
    { code: 'LYD', nameAr: 'دينار ليبي', nameEn: 'Libyan Dinar', symbol: 'د.ل' },
    { code: 'KES', nameAr: 'شلن كيني', nameEn: 'Kenyan Shilling', symbol: 'KSh' },
    { code: 'ETB', nameAr: 'بير إثيوبي', nameEn: 'Ethiopian Birr', symbol: 'Br' },
    { code: 'TRY', nameAr: 'ليرة تركية', nameEn: 'Turkish Lira', symbol: '₺' },
    { code: 'MYR', nameAr: 'رينغيت ماليزي', nameEn: 'Malaysian Ringgit', symbol: 'RM' }
  ];

  const COUNTRY_TO_CURRENCY = {
    SD: 'SDG', EG: 'EGP', SA: 'SAR', AE: 'AED', QA: 'QAR', KW: 'KWD',
    BH: 'BHD', OM: 'OMR', JO: 'JOD', MA: 'MAD', TN: 'TND', DZ: 'DZD',
    LY: 'LYD', KE: 'KES', ET: 'ETB', TR: 'TRY', MY: 'MYR', US: 'USD',
    GB: 'GBP', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR'
  };

  // Priority Arab & regional countries first, followed by major global markets
  const COUNTRIES = [
    { code: 'SD', nameAr: 'السودان', nameEn: 'Sudan', defaultCurrency: 'SDG' },
    { code: 'EG', nameAr: 'مصر', nameEn: 'Egypt', defaultCurrency: 'EGP' },
    { code: 'SA', nameAr: 'المملكة العربية السعودية', nameEn: 'Saudi Arabia', defaultCurrency: 'SAR' },
    { code: 'AE', nameAr: 'الإمارات العربية المتحدة', nameEn: 'United Arab Emirates', defaultCurrency: 'AED' },
    { code: 'QA', nameAr: 'قطر', nameEn: 'Qatar', defaultCurrency: 'QAR' },
    { code: 'KW', nameAr: 'الكويت', nameEn: 'Kuwait', defaultCurrency: 'KWD' },
    { code: 'BH', nameAr: 'البحرين', nameEn: 'Bahrain', defaultCurrency: 'BHD' },
    { code: 'OM', nameAr: 'عُمان', nameEn: 'Oman', defaultCurrency: 'OMR' },
    { code: 'JO', nameAr: 'الأردن', nameEn: 'Jordan', defaultCurrency: 'JOD' },
    { code: 'LY', nameAr: 'ليبيا', nameEn: 'Libya', defaultCurrency: 'LYD' },
    { code: 'MA', nameAr: 'المغرب', nameEn: 'Morocco', defaultCurrency: 'MAD' },
    { code: 'TN', nameAr: 'تونس', nameEn: 'Tunisia', defaultCurrency: 'TND' },
    { code: 'DZ', nameAr: 'الجزائر', nameEn: 'Algeria', defaultCurrency: 'DZD' },
    { code: 'IQ', nameAr: 'العراق', nameEn: 'Iraq', defaultCurrency: 'USD' },
    { code: 'YE', nameAr: 'اليمن', nameEn: 'Yemen', defaultCurrency: 'USD' },
    { code: 'SY', nameAr: 'سوريا', nameEn: 'Syria', defaultCurrency: 'USD' },
    { code: 'LB', nameAr: 'لبنان', nameEn: 'Lebanon', defaultCurrency: 'USD' },
    { code: 'PS', nameAr: 'فلسطين', nameEn: 'Palestine', defaultCurrency: 'USD' },
    { code: 'MR', nameAr: 'موريتانيا', nameEn: 'Mauritania', defaultCurrency: 'USD' },
    { code: 'SO', nameAr: 'الصومال', nameEn: 'Somalia', defaultCurrency: 'USD' },
    { code: 'DJ', nameAr: 'جيبوتي', nameEn: 'Djibouti', defaultCurrency: 'USD' },
    { code: 'KM', nameAr: 'جزر القمر', nameEn: 'Comoros', defaultCurrency: 'USD' },
    { code: 'SS', nameAr: 'جنوب السودان', nameEn: 'South Sudan', defaultCurrency: 'USD' },
    { code: 'TD', nameAr: 'تشاد', nameEn: 'Chad', defaultCurrency: 'USD' },
    { code: 'ET', nameAr: 'إثيوبيا', nameEn: 'Ethiopia', defaultCurrency: 'ETB' },
    { code: 'ER', nameAr: 'إريتريا', nameEn: 'Eritrea', defaultCurrency: 'USD' },
    { code: 'KE', nameAr: 'كينيا', nameEn: 'Kenya', defaultCurrency: 'KES' },
    { code: 'UG', nameAr: 'أوغندا', nameEn: 'Uganda', defaultCurrency: 'USD' },
    { code: 'RW', nameAr: 'رواندا', nameEn: 'Rwanda', defaultCurrency: 'USD' },
    { code: 'TZ', nameAr: 'تنزانيا', nameEn: 'Tanzania', defaultCurrency: 'USD' },
    { code: 'NG', nameAr: 'نيجيريا', nameEn: 'Nigeria', defaultCurrency: 'USD' },
    { code: 'ZA', nameAr: 'جنوب أفريقيا', nameEn: 'South Africa', defaultCurrency: 'USD' },
    { code: 'TR', nameAr: 'تركيا', nameEn: 'Turkey', defaultCurrency: 'TRY' },
    { code: 'MY', nameAr: 'ماليزيا', nameEn: 'Malaysia', defaultCurrency: 'MYR' },
    { code: 'ID', nameAr: 'إندونيسيا', nameEn: 'Indonesia', defaultCurrency: 'USD' },
    { code: 'GB', nameAr: 'المملكة المتحدة', nameEn: 'United Kingdom', defaultCurrency: 'GBP' },
    { code: 'US', nameAr: 'الولايات المتحدة', nameEn: 'United States', defaultCurrency: 'USD' },
    { code: 'CA', nameAr: 'كندا', nameEn: 'Canada', defaultCurrency: 'USD' },
    { code: 'DE', nameAr: 'ألمانيا', nameEn: 'Germany', defaultCurrency: 'EUR' },
    { code: 'FR', nameAr: 'فرنسا', nameEn: 'France', defaultCurrency: 'EUR' },
    { code: 'IT', nameAr: 'إيطاليا', nameEn: 'Italy', defaultCurrency: 'EUR' },
    { code: 'ES', nameAr: 'إسبانيا', nameEn: 'Spain', defaultCurrency: 'EUR' },
    { code: 'NL', nameAr: 'هولندا', nameEn: 'Netherlands', defaultCurrency: 'EUR' },
    { code: 'SE', nameAr: 'السويد', nameEn: 'Sweden', defaultCurrency: 'EUR' },
    { code: 'NO', nameAr: 'النرويج', nameEn: 'Norway', defaultCurrency: 'EUR' },
    { code: 'CH', nameAr: 'سويسرا', nameEn: 'Switzerland', defaultCurrency: 'EUR' },
    { code: 'AU', nameAr: 'أستراليا', nameEn: 'Australia', defaultCurrency: 'USD' },
    { code: 'IN', nameAr: 'الهند', nameEn: 'India', defaultCurrency: 'USD' },
    { code: 'CN', nameAr: 'الصين', nameEn: 'China', defaultCurrency: 'USD' }
  ];

  const SUDAN_LOCALITIES = {
    'الخرطوم': ['الخرطوم', 'أم درمان', 'بحري', 'شرق النيل', 'جبل أولياء', 'كرري', 'أمبدة'],
    'الجزيرة': ['ود مدني الكبرى', 'المناقل', 'الحصاحيصا', 'الكاملين', 'شرق الجزيرة', 'جنوب الجزيرة', 'أم القرى', 'القرشي'],
    'نهر النيل': ['عطبرة', 'الدامر', 'شندي', 'بربر', 'أبو حمد', 'المتمة', 'البحيرة'],
    'الشمالية': ['دنقلا', 'مروي', 'الدبة', 'وادي حلفا', 'دلقو', 'البرقيق', 'القولد'],
    'كسلا': ['كسلا', 'حلفا الجديدة', 'خشم القربة', 'همشكوريب', 'تلكوك', 'ريفي كسلا', 'غرب كسلا', 'شمال الدلتا', 'أروما', 'ود الحليو', 'نهر عطبرة'],
    'القضارف': ['بلدية القضارف', 'الفاو', 'الحواتة', 'الرحد', 'القلابات الشرقية', 'القلابات الغربية', 'قلع النحل', 'باسندة', 'البطانة', 'الفرشقة', 'وسط القضارف', 'القريشة'],
    'البحر الأحمر': ['بورتسودان', 'سواكن', 'سنكات', 'طوكر', 'هيا', 'جبيت المعادن', 'عقيق', 'حلايب', 'درديب', 'القنب والأوليب'],
    'سنار': ['سنجة', 'سنار', 'الدندر', 'السوكي', 'شرق سنار', 'أبو حجار', 'الدالي والمزموم'],
    'النيل الأزرق': ['الدمازين', 'الروصيرص', 'باو', 'الكرمك', 'قيسان', 'التضامن', 'ود الماحي'],
    'النيل الأبيض': ['ربك', 'كوستي', 'الدويم', 'القطينة', 'تندلتي', 'الجبلين', 'السلام', 'أم رمتة', 'قلي'],
    'شمال كردفان': ['شيكان (الأبيض)', 'الرهد', 'أم روابة', 'بارا', 'سودري', 'جبرة الشيخ', 'غرب بارا', 'أم دم حاج أحمد'],
    'جنوب كردفان': ['كادقلي', 'الدلنج', 'أبو جبيهة', 'رشاد', 'العباسية', 'تلودي', 'هبيلا', 'القوز', 'قدير', 'الريف الشرقي', 'البرام', 'هيبان', 'أم دورين', 'لقاوة'],
    'غرب كردفان': ['النهود', 'الفولة', 'بابنوسة', 'المجلد', 'أبيي', 'غبيش', 'الخوي', 'الأضية', 'ود بندا', 'كيلك', 'لقاوة', 'السنوط', 'أبو زبد', 'الميرم'],
    'شمال دارفور': ['الفاشر', 'كتم', 'مليط', 'أم كدادة', 'كبكابية', 'سرف عمرة', 'الكومة', 'المالحة', 'دار السلام', 'الطويشة', 'كلمندو', 'اللعيت', 'طويلة', 'أم برو', 'كرنوي', 'عديلة', 'الواحة'],
    'جنوب دارفور': ['نيالا شمال', 'نيالا جنوب', 'عد الفرسان', 'رهيد البردي', 'كاس', 'تلس', 'برام', 'قريضة', 'شرق جبل مرة', 'شطايا', 'الردوم', 'دمسو', 'السنطة', 'كاتيلا', 'مرشنج', 'نتيقة', 'كبنقا', 'السلام', 'بليل', 'الوحدة'],
    'غرب دارفور': ['الجنينة', 'كرينك', 'بيضة', 'سربا', 'كلبس', 'جبل مون', 'هبيلة', 'فوربرنقا'],
    'وسط دارفور': ['زالنجي', 'وادي صالح', 'مكجر', 'بندسي', 'أزوم', 'نيرتتي', 'روكرو', 'أم دخن', 'غرب جبل مرة'],
    'شرق دارفور': ['الضعين', 'عديلة', 'أبو جابرة', 'بحر العرب', 'الفردوس', 'أبو كارينكا', 'شعيرية', 'ياسين', 'عسلاية']
  };

  const SUDAN_STATES = Object.keys(SUDAN_LOCALITIES);

  // Regional/Governorate catalogs for key Arab & regional countries
  const COUNTRY_REGIONS = {
    SD: SUDAN_STATES,
    EG: ['القاهرة', 'الجيزة', 'الإسكندرية', 'أسوان', 'الأقصر', 'القليوبية', 'الشرقية', 'الدقهلية', 'البحر الأحمر', 'مطروح', 'أسيوط', 'سوهاج', 'قنا', 'السويس', 'بورسعيد', 'الإسماعيلية', 'الغربية', 'المنوفية', 'البحيرة', 'كفر الشيخ', 'الفيوم', 'بني سويف', 'المنيا'],
    SA: ['الرياض', 'مكة المكرمة', 'المدينة المنورة', 'المنطقة الشرقية', 'عسير', 'جازان', 'القصيم', 'تبوك', 'حائل', 'نجران', 'الجوف', 'الباحة', 'الحدود الشمالية'],
    AE: ['دبي', 'أبوظبي', 'الشارقة', 'عجمان', 'رأس الخيمة', 'الفجيرة', 'أم القيوين'],
    QA: ['الدوحة', 'الريان', 'الوكرة', 'الخور', 'الشمال', 'أم صلال', 'الظعاين', 'الشحانية'],
    KW: ['العاصمة', 'حولي', 'الفروانية', 'الأحمدي', 'الجهراء', 'مبارك الكبير'],
    OM: ['مسقط', 'ظفار', 'مسندم', 'البريمي', 'الداخلية', 'شمال الباطنة', 'جنوب الباطنة', 'شمال الشرقية', 'جنوب الشرقية', 'الظاهرة', 'الوسطى'],
    BH: ['المنامة', 'المحرق', 'الشمالية', 'الجنوبية'],
    JO: ['عمان', 'إربد', 'الزرقاء', 'العقبة', 'البلقاء', 'المفرق', 'جرش', 'عجلون', 'مادبا', 'الكرك', 'الطفيلة', 'معان'],
    LY: ['طرابلس', 'بنغازي', 'مصراتة', 'سبها', 'الكفرة', 'الزاوية', 'زليتن', 'البيضاء', 'طبرق', 'درنة', 'غريان', 'سرت'],
    ET: ['أديس أبابا', 'أمهرة', 'أوروميا', 'تيغراي', 'بني شنقول - قماز', 'هرر', 'ديري داوا', 'عفر', 'الصومال الإثيوبي'],
    KE: ['نيروبي', 'مومباسا', 'كيسومو', 'ناكورو', 'إلدوريت'],
    UG: ['كمبالا', 'واكيسو', 'عنتيبي', 'جينجا', 'مبارارا'],
    SS: ['جوبا', 'واو', 'ملكال', 'يامبيو', 'بور', 'رمبيك', 'أويل'],
    TD: ['انجمينا', 'أبشي', 'ماو', 'موندو', 'سار'],
    TR: ['إسطنبول', 'أنقرة', 'إزمير', 'بورصة', 'أنطاليا', 'غازي عنتاب', 'قونية'],
    MY: ['كوالالمبور', 'سيلانغور', 'جوهور', 'بينانغ', 'بوتراجايا']
  };

  function getRegionsForCountry(countryCode) {
    if (!countryCode || countryCode === 'ALL' || countryCode === 'all') {
      return SUDAN_STATES;
    }
    const cc = String(countryCode).toUpperCase();
    return COUNTRY_REGIONS[cc] || [];
  }

  function getLocalitiesForRegion(countryCode, regionName) {
    const cc = String(countryCode || 'SD').toUpperCase();
    if (cc === 'SD' || cc === 'ALL' || !countryCode) {
      return SUDAN_LOCALITIES[regionName] || [];
    }
    return [];
  }

  const UNION_CATEGORIES = [
    { id: 'construction', labelAr: 'المقاولات والبناء', icon: 'architecture' },
    { id: 'engineering', labelAr: 'الهندسة والتقنية', icon: 'engineering' },
    { id: 'commerce', labelAr: 'التجارة والمبيعات', icon: 'storefront' },
    { id: 'transport', labelAr: 'النقل والترحيل', icon: 'local_shipping' },
    { id: 'maintenance', labelAr: 'الصيانة والحرف', icon: 'build' },
    { id: 'agriculture', labelAr: 'الزراعة والإنتاج', icon: 'agriculture' },
    { id: 'medical', labelAr: 'الطب والصحة', icon: 'medical_services' },
    { id: 'education', labelAr: 'التعليم والتدريب', icon: 'school' },
    { id: 'technology', labelAr: 'البرمجة وتكنولوجيا المعلومات', icon: 'computer' },
    { id: 'art', labelAr: 'الفنون والتصميم', icon: 'palette' },
    { id: 'general', labelAr: 'نقابة عامة', icon: 'groups' }
  ];

  const SQUAD_CATEGORIES = [
    { id: 'construction', labelAr: 'بناء ومقاولات' },
    { id: 'finishing', labelAr: 'تشطيبات وديكور' },
    { id: 'software', labelAr: 'برمجيات وتصميم' },
    { id: 'events', labelAr: 'تجهيز مناسبات' },
    { id: 'maintenance', labelAr: 'صيانة شاملة' },
    { id: 'autoRepair', labelAr: 'ميكانيكا وكهرباء سيارات' },
    { id: 'logistics', labelAr: 'نقل وخدمات لوجستية' },
    { id: 'other', labelAr: 'أخرى' }
  ];

  const ORDER_STATUSES = [
    { id: 'pending', labelAr: 'قيد الانتظار', badgeClass: 'pending' },
    { id: 'confirmed', labelAr: 'تم التأكيد', badgeClass: 'info' },
    { id: 'shipped', labelAr: 'قيد التوصيل', badgeClass: 'warning' },
    { id: 'delivered', labelAr: 'تم التسليم', badgeClass: 'reviewed' },
    { id: 'cancelled', labelAr: 'ملغي', badgeClass: 'dismissed' }
  ];

  const JOB_STATUSES = [
    { id: 'open', labelAr: 'مفتوح للعروض', badgeClass: 'info' },
    { id: 'inProgress', labelAr: 'قيد التنفيذ', badgeClass: 'warning' },
    { id: 'completed', labelAr: 'مكتمل', badgeClass: 'reviewed' },
    { id: 'cancelled', labelAr: 'ملغي', badgeClass: 'dismissed' }
  ];

  const PAYMENT_TYPES = [
    { id: 'bank_transfer', labelAr: 'تحويل بنكي (Bank Transfer)' },
    { id: 'wallet', labelAr: 'محفظة إلكترونية (Mobile Wallet)' },
    { id: 'paypal', labelAr: 'بايبال (PayPal)' },
    { id: 'card', labelAr: 'بطاقة دفع (Card)' }
  ];

  const NEWS_CATEGORIES = [
    'عام',
    'أخبار المستخدمين',
    'اقتصاد',
    'رياضة',
    'تكنولوجيا',
    'صحة'
  ];

  const MARKET_FEATURES = [
    { id: 'jobs', labelAr: 'الوظائف والمشاريع (Jobs)' },
    { id: 'shops', labelAr: 'المتاجر والمنتجات (Shops)' },
    { id: 'news', labelAr: 'الأخبار (News)' },
    { id: 'unions', labelAr: 'النقابات المهنية (Unions)' },
    { id: 'squads', labelAr: 'فرق العمل (Squads)' },
    { id: 'community', labelAr: 'مجتمع المنشورات (Community)' }
  ];

  function getCountryName(code) {
    if (!code || code === 'ALL' || code === 'all') return 'كل الدول (عالمي)';
    const upper = String(code).toUpperCase();
    const found = COUNTRIES.find(c => c.code === upper);
    return found ? `${found.nameAr} (${found.code})` : upper;
  }

  function getCurrencyLabel(code) {
    if (!code) return 'SDG';
    const upper = String(code).toUpperCase();
    const found = CURRENCIES.find(c => c.code === upper);
    return found ? `${found.code} — ${found.nameAr}` : upper;
  }

  function getDefaultCurrencyForCountry(countryCode) {
    if (!countryCode || countryCode === 'ALL') return 'SDG';
    return COUNTRY_TO_CURRENCY[String(countryCode).toUpperCase()] || 'USD';
  }

  function getUnionCategoryName(catId) {
    const found = UNION_CATEGORIES.find(c => c.id === catId);
    return found ? found.labelAr : (catId || 'عام');
  }

  function getSquadCategoryName(catId) {
    const found = SQUAD_CATEGORIES.find(c => c.id === catId);
    return found ? found.labelAr : (catId || 'أخرى');
  }

  function getOrderStatusMeta(status) {
    return ORDER_STATUSES.find(s => s.id === status) || {
      id: status || 'pending',
      labelAr: status || 'قيد الانتظار',
      badgeClass: 'pending'
    };
  }

  function getJobStatusMeta(status) {
    return JOB_STATUSES.find(s => s.id === status) || {
      id: status || 'open',
      labelAr: status || 'مفتوح',
      badgeClass: 'info'
    };
  }

  /**
   * Checks whether a record matches the active country filter.
   * For Sudan ('SD'), legacy records with missing countryCode also match.
   */
  function matchesCountry(recordCountryCode, activeCountry, allowGlobalAll = false) {
    if (!activeCountry || activeCountry === 'ALL' || activeCountry === 'all') return true;
    const target = String(activeCountry).toUpperCase();
    const rec = String(recordCountryCode || 'SD').toUpperCase();
    if (allowGlobalAll && rec === 'ALL') return true;
    return rec === target;
  }

  window.AvyraCatalogs = {
    CURRENCIES,
    COUNTRY_TO_CURRENCY,
    COUNTRIES,
    SUDAN_STATES,
    SUDAN_LOCALITIES,
    COUNTRY_REGIONS,
    UNION_CATEGORIES,
    SQUAD_CATEGORIES,
    ORDER_STATUSES,
    JOB_STATUSES,
    PAYMENT_TYPES,
    NEWS_CATEGORIES,
    MARKET_FEATURES,
    getRegionsForCountry,
    getLocalitiesForRegion,
    getCountryName,
    getCurrencyLabel,
    getDefaultCurrencyForCountry,
    getUnionCategoryName,
    getSquadCategoryName,
    getOrderStatusMeta,
    getJobStatusMeta,
    matchesCountry
  };
})();
