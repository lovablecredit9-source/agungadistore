// Full list of world languages with country flag emojis
// Using Unicode regional indicator symbols for flags

export interface LanguageOption {
  code: string;
  name: string;      // Native name
  nameEn: string;    // English name
  flag: string;       // Flag emoji
  region: string;     // Region for grouping
}

export const LANGUAGES: LanguageOption[] = [
  // Asia Tenggara
  { code: "id", name: "Bahasa Indonesia", nameEn: "Indonesian", flag: "🇮🇩", region: "Asia" },
  { code: "ms", name: "Bahasa Melayu", nameEn: "Malay", flag: "🇲🇾", region: "Asia" },
  { code: "tl", name: "Filipino", nameEn: "Filipino", flag: "🇵🇭", region: "Asia" },
  { code: "th", name: "ไทย", nameEn: "Thai", flag: "🇹🇭", region: "Asia" },
  { code: "vi", name: "Tiếng Việt", nameEn: "Vietnamese", flag: "🇻🇳", region: "Asia" },
  { code: "my", name: "မြန်မာဘာသာ", nameEn: "Burmese", flag: "🇲🇲", region: "Asia" },
  { code: "km", name: "ភាសាខ្មែរ", nameEn: "Khmer", flag: "🇰🇭", region: "Asia" },
  { code: "lo", name: "ລາວ", nameEn: "Lao", flag: "🇱🇦", region: "Asia" },
  { code: "jv", name: "Basa Jawa", nameEn: "Javanese", flag: "🇮🇩", region: "Asia" },
  { code: "su", name: "Basa Sunda", nameEn: "Sundanese", flag: "🇮🇩", region: "Asia" },

  // Asia Timur
  { code: "zh", name: "中文", nameEn: "Chinese", flag: "🇨🇳", region: "Asia" },
  { code: "ja", name: "日本語", nameEn: "Japanese", flag: "🇯🇵", region: "Asia" },
  { code: "ko", name: "한국어", nameEn: "Korean", flag: "🇰🇷", region: "Asia" },
  { code: "zh-TW", name: "繁體中文", nameEn: "Chinese (Traditional)", flag: "🇹🇼", region: "Asia" },
  { code: "mn", name: "Монгол", nameEn: "Mongolian", flag: "🇲🇳", region: "Asia" },

  // Asia Selatan
  { code: "hi", name: "हिन्दी", nameEn: "Hindi", flag: "🇮🇳", region: "Asia" },
  { code: "bn", name: "বাংলা", nameEn: "Bengali", flag: "🇧🇩", region: "Asia" },
  { code: "ur", name: "اردو", nameEn: "Urdu", flag: "🇵🇰", region: "Asia" },
  { code: "ta", name: "தமிழ்", nameEn: "Tamil", flag: "🇮🇳", region: "Asia" },
  { code: "te", name: "తెలుగు", nameEn: "Telugu", flag: "🇮🇳", region: "Asia" },
  { code: "mr", name: "मराठी", nameEn: "Marathi", flag: "🇮🇳", region: "Asia" },
  { code: "gu", name: "ગુજરાતી", nameEn: "Gujarati", flag: "🇮🇳", region: "Asia" },
  { code: "kn", name: "ಕನ್ನಡ", nameEn: "Kannada", flag: "🇮🇳", region: "Asia" },
  { code: "ml", name: "മലയാളം", nameEn: "Malayalam", flag: "🇮🇳", region: "Asia" },
  { code: "pa", name: "ਪੰਜਾਬੀ", nameEn: "Punjabi", flag: "🇮🇳", region: "Asia" },
  { code: "si", name: "සිංහල", nameEn: "Sinhala", flag: "🇱🇰", region: "Asia" },
  { code: "ne", name: "नेपाली", nameEn: "Nepali", flag: "🇳🇵", region: "Asia" },
  { code: "or", name: "ଓଡ଼ିଆ", nameEn: "Odia", flag: "🇮🇳", region: "Asia" },
  { code: "as", name: "অসমীয়া", nameEn: "Assamese", flag: "🇮🇳", region: "Asia" },

  // Asia Tengah & Barat
  { code: "fa", name: "فارسی", nameEn: "Persian", flag: "🇮🇷", region: "Asia" },
  { code: "ar", name: "العربية", nameEn: "Arabic", flag: "🇸🇦", region: "Middle East" },
  { code: "tr", name: "Türkçe", nameEn: "Turkish", flag: "🇹🇷", region: "Asia" },
  { code: "he", name: "עברית", nameEn: "Hebrew", flag: "🇮🇱", region: "Middle East" },
  { code: "ka", name: "ქართული", nameEn: "Georgian", flag: "🇬🇪", region: "Asia" },
  { code: "hy", name: "Հայերեն", nameEn: "Armenian", flag: "🇦🇲", region: "Asia" },
  { code: "az", name: "Azərbaycan", nameEn: "Azerbaijani", flag: "🇦🇿", region: "Asia" },
  { code: "kk", name: "Қазақ", nameEn: "Kazakh", flag: "🇰🇿", region: "Asia" },
  { code: "uz", name: "Oʻzbek", nameEn: "Uzbek", flag: "🇺🇿", region: "Asia" },
  { code: "tg", name: "Тоҷикӣ", nameEn: "Tajik", flag: "🇹🇯", region: "Asia" },
  { code: "tk", name: "Türkmen", nameEn: "Turkmen", flag: "🇹🇲", region: "Asia" },
  { code: "ky", name: "Кыргызча", nameEn: "Kyrgyz", flag: "🇰🇬", region: "Asia" },
  { code: "ku", name: "Kurdî", nameEn: "Kurdish", flag: "🇮🇶", region: "Middle East" },
  { code: "ps", name: "پښتو", nameEn: "Pashto", flag: "🇦🇫", region: "Asia" },

  // Eropa Barat
  { code: "en", name: "English", nameEn: "English", flag: "🇬🇧", region: "Europe" },
  { code: "fr", name: "Français", nameEn: "French", flag: "🇫🇷", region: "Europe" },
  { code: "de", name: "Deutsch", nameEn: "German", flag: "🇩🇪", region: "Europe" },
  { code: "es", name: "Español", nameEn: "Spanish", flag: "🇪🇸", region: "Europe" },
  { code: "pt", name: "Português", nameEn: "Portuguese", flag: "🇵🇹", region: "Europe" },
  { code: "it", name: "Italiano", nameEn: "Italian", flag: "🇮🇹", region: "Europe" },
  { code: "nl", name: "Nederlands", nameEn: "Dutch", flag: "🇳🇱", region: "Europe" },
  { code: "ca", name: "Català", nameEn: "Catalan", flag: "🇪🇸", region: "Europe" },
  { code: "gl", name: "Galego", nameEn: "Galician", flag: "🇪🇸", region: "Europe" },
  { code: "eu", name: "Euskara", nameEn: "Basque", flag: "🇪🇸", region: "Europe" },
  { code: "lb", name: "Lëtzebuergesch", nameEn: "Luxembourgish", flag: "🇱🇺", region: "Europe" },

  // Eropa Utara
  { code: "sv", name: "Svenska", nameEn: "Swedish", flag: "🇸🇪", region: "Europe" },
  { code: "no", name: "Norsk", nameEn: "Norwegian", flag: "🇳🇴", region: "Europe" },
  { code: "da", name: "Dansk", nameEn: "Danish", flag: "🇩🇰", region: "Europe" },
  { code: "fi", name: "Suomi", nameEn: "Finnish", flag: "🇫🇮", region: "Europe" },
  { code: "is", name: "Íslenska", nameEn: "Icelandic", flag: "🇮🇸", region: "Europe" },
  { code: "et", name: "Eesti", nameEn: "Estonian", flag: "🇪🇪", region: "Europe" },
  { code: "lv", name: "Latviešu", nameEn: "Latvian", flag: "🇱🇻", region: "Europe" },
  { code: "lt", name: "Lietuvių", nameEn: "Lithuanian", flag: "🇱🇹", region: "Europe" },

  // Eropa Timur
  { code: "ru", name: "Русский", nameEn: "Russian", flag: "🇷🇺", region: "Europe" },
  { code: "uk", name: "Українська", nameEn: "Ukrainian", flag: "🇺🇦", region: "Europe" },
  { code: "pl", name: "Polski", nameEn: "Polish", flag: "🇵🇱", region: "Europe" },
  { code: "cs", name: "Čeština", nameEn: "Czech", flag: "🇨🇿", region: "Europe" },
  { code: "sk", name: "Slovenčina", nameEn: "Slovak", flag: "🇸🇰", region: "Europe" },
  { code: "hu", name: "Magyar", nameEn: "Hungarian", flag: "🇭🇺", region: "Europe" },
  { code: "ro", name: "Română", nameEn: "Romanian", flag: "🇷🇴", region: "Europe" },
  { code: "bg", name: "Български", nameEn: "Bulgarian", flag: "🇧🇬", region: "Europe" },
  { code: "hr", name: "Hrvatski", nameEn: "Croatian", flag: "🇭🇷", region: "Europe" },
  { code: "sr", name: "Српски", nameEn: "Serbian", flag: "🇷🇸", region: "Europe" },
  { code: "bs", name: "Bosanski", nameEn: "Bosnian", flag: "🇧🇦", region: "Europe" },
  { code: "sl", name: "Slovenščina", nameEn: "Slovenian", flag: "🇸🇮", region: "Europe" },
  { code: "mk", name: "Македонски", nameEn: "Macedonian", flag: "🇲🇰", region: "Europe" },
  { code: "sq", name: "Shqip", nameEn: "Albanian", flag: "🇦🇱", region: "Europe" },
  { code: "el", name: "Ελληνικά", nameEn: "Greek", flag: "🇬🇷", region: "Europe" },
  { code: "be", name: "Беларуская", nameEn: "Belarusian", flag: "🇧🇾", region: "Europe" },
  { code: "md", name: "Moldovenească", nameEn: "Moldovan", flag: "🇲🇩", region: "Europe" },

  // Eropa Lain
  { code: "ga", name: "Gaeilge", nameEn: "Irish", flag: "🇮🇪", region: "Europe" },
  { code: "cy", name: "Cymraeg", nameEn: "Welsh", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", region: "Europe" },
  { code: "gd", name: "Gàidhlig", nameEn: "Scottish Gaelic", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", region: "Europe" },
  { code: "mt", name: "Malti", nameEn: "Maltese", flag: "🇲🇹", region: "Europe" },

  // Afrika
  { code: "sw", name: "Kiswahili", nameEn: "Swahili", flag: "🇰🇪", region: "Africa" },
  { code: "am", name: "አማርኛ", nameEn: "Amharic", flag: "🇪🇹", region: "Africa" },
  { code: "ha", name: "Hausa", nameEn: "Hausa", flag: "🇳🇬", region: "Africa" },
  { code: "yo", name: "Yorùbá", nameEn: "Yoruba", flag: "🇳🇬", region: "Africa" },
  { code: "ig", name: "Igbo", nameEn: "Igbo", flag: "🇳🇬", region: "Africa" },
  { code: "zu", name: "isiZulu", nameEn: "Zulu", flag: "🇿🇦", region: "Africa" },
  { code: "xh", name: "isiXhosa", nameEn: "Xhosa", flag: "🇿🇦", region: "Africa" },
  { code: "af", name: "Afrikaans", nameEn: "Afrikaans", flag: "🇿🇦", region: "Africa" },
  { code: "st", name: "Sesotho", nameEn: "Sotho", flag: "🇱🇸", region: "Africa" },
  { code: "tn", name: "Setswana", nameEn: "Tswana", flag: "🇧🇼", region: "Africa" },
  { code: "rw", name: "Kinyarwanda", nameEn: "Kinyarwanda", flag: "🇷🇼", region: "Africa" },
  { code: "mg", name: "Malagasy", nameEn: "Malagasy", flag: "🇲🇬", region: "Africa" },
  { code: "so", name: "Soomaali", nameEn: "Somali", flag: "🇸🇴", region: "Africa" },
  { code: "ti", name: "ትግርኛ", nameEn: "Tigrinya", flag: "🇪🇷", region: "Africa" },
  { code: "ny", name: "Chichewa", nameEn: "Chichewa", flag: "🇲🇼", region: "Africa" },
  { code: "sn", name: "chiShona", nameEn: "Shona", flag: "🇿🇼", region: "Africa" },
  { code: "lg", name: "Luganda", nameEn: "Luganda", flag: "🇺🇬", region: "Africa" },
  { code: "ln", name: "Lingála", nameEn: "Lingala", flag: "🇨🇩", region: "Africa" },
  { code: "wo", name: "Wolof", nameEn: "Wolof", flag: "🇸🇳", region: "Africa" },
  { code: "ff", name: "Fulfulde", nameEn: "Fula", flag: "🇬🇳", region: "Africa" },
  { code: "bm", name: "Bamanankan", nameEn: "Bambara", flag: "🇲🇱", region: "Africa" },
  { code: "ak", name: "Akan", nameEn: "Akan", flag: "🇬🇭", region: "Africa" },
  { code: "ee", name: "Eʋegbe", nameEn: "Ewe", flag: "🇬🇭", region: "Africa" },
  { code: "om", name: "Afaan Oromoo", nameEn: "Oromo", flag: "🇪🇹", region: "Africa" },

  // Amerika
  { code: "en-US", name: "English (US)", nameEn: "English (US)", flag: "🇺🇸", region: "Americas" },
  { code: "pt-BR", name: "Português (Brasil)", nameEn: "Portuguese (Brazil)", flag: "🇧🇷", region: "Americas" },
  { code: "es-MX", name: "Español (México)", nameEn: "Spanish (Mexico)", flag: "🇲🇽", region: "Americas" },
  { code: "es-AR", name: "Español (Argentina)", nameEn: "Spanish (Argentina)", flag: "🇦🇷", region: "Americas" },
  { code: "es-CO", name: "Español (Colombia)", nameEn: "Spanish (Colombia)", flag: "🇨🇴", region: "Americas" },
  { code: "es-CL", name: "Español (Chile)", nameEn: "Spanish (Chile)", flag: "🇨🇱", region: "Americas" },
  { code: "es-PE", name: "Español (Perú)", nameEn: "Spanish (Peru)", flag: "🇵🇪", region: "Americas" },
  { code: "es-VE", name: "Español (Venezuela)", nameEn: "Spanish (Venezuela)", flag: "🇻🇪", region: "Americas" },
  { code: "en-CA", name: "English (Canada)", nameEn: "English (Canada)", flag: "🇨🇦", region: "Americas" },
  { code: "fr-CA", name: "Français (Canada)", nameEn: "French (Canada)", flag: "🇨🇦", region: "Americas" },
  { code: "ht", name: "Kreyòl Ayisyen", nameEn: "Haitian Creole", flag: "🇭🇹", region: "Americas" },
  { code: "gn", name: "Avañeʼẽ", nameEn: "Guarani", flag: "🇵🇾", region: "Americas" },
  { code: "qu", name: "Runasimi", nameEn: "Quechua", flag: "🇵🇪", region: "Americas" },
  { code: "ay", name: "Aymar aru", nameEn: "Aymara", flag: "🇧🇴", region: "Americas" },

  // Oseania
  { code: "en-AU", name: "English (Australia)", nameEn: "English (Australia)", flag: "🇦🇺", region: "Oceania" },
  { code: "en-NZ", name: "English (New Zealand)", nameEn: "English (New Zealand)", flag: "🇳🇿", region: "Oceania" },
  { code: "mi", name: "Te Reo Māori", nameEn: "Māori", flag: "🇳🇿", region: "Oceania" },
  { code: "sm", name: "Gagana Sāmoa", nameEn: "Samoan", flag: "🇼🇸", region: "Oceania" },
  { code: "to", name: "Lea Faka-Tonga", nameEn: "Tongan", flag: "🇹🇴", region: "Oceania" },
  { code: "fj", name: "Vosa Vakaviti", nameEn: "Fijian", flag: "🇫🇯", region: "Oceania" },
  { code: "haw", name: "ʻŌlelo Hawaiʻi", nameEn: "Hawaiian", flag: "🇺🇸", region: "Oceania" },

  // Timur Tengah & Afrika Utara tambahan
  { code: "ar-EG", name: "العربية (مصر)", nameEn: "Arabic (Egypt)", flag: "🇪🇬", region: "Middle East" },
  { code: "ar-MA", name: "العربية (المغرب)", nameEn: "Arabic (Morocco)", flag: "🇲🇦", region: "Middle East" },
  { code: "ar-DZ", name: "العربية (الجزائر)", nameEn: "Arabic (Algeria)", flag: "🇩🇿", region: "Middle East" },
  { code: "ar-TN", name: "العربية (تونس)", nameEn: "Arabic (Tunisia)", flag: "🇹🇳", region: "Middle East" },
  { code: "ar-IQ", name: "العربية (العراق)", nameEn: "Arabic (Iraq)", flag: "🇮🇶", region: "Middle East" },
  { code: "ar-JO", name: "العربية (الأردن)", nameEn: "Arabic (Jordan)", flag: "🇯🇴", region: "Middle East" },
  { code: "ar-LB", name: "العربية (لبنان)", nameEn: "Arabic (Lebanon)", flag: "🇱🇧", region: "Middle East" },
  { code: "ar-AE", name: "العربية (الإمارات)", nameEn: "Arabic (UAE)", flag: "🇦🇪", region: "Middle East" },
  { code: "ar-QA", name: "العربية (قطر)", nameEn: "Arabic (Qatar)", flag: "🇶🇦", region: "Middle East" },
  { code: "ar-KW", name: "العربية (الكويت)", nameEn: "Arabic (Kuwait)", flag: "🇰🇼", region: "Middle East" },
  { code: "ar-BH", name: "العربية (البحرين)", nameEn: "Arabic (Bahrain)", flag: "🇧🇭", region: "Middle East" },
  { code: "ar-OM", name: "العربية (عمان)", nameEn: "Arabic (Oman)", flag: "🇴🇲", region: "Middle East" },
  { code: "ar-YE", name: "العربية (اليمن)", nameEn: "Arabic (Yemen)", flag: "🇾🇪", region: "Middle East" },
  { code: "ar-LY", name: "العربية (ليبيا)", nameEn: "Arabic (Libya)", flag: "🇱🇾", region: "Middle East" },
  { code: "ar-SD", name: "العربية (السودان)", nameEn: "Arabic (Sudan)", flag: "🇸🇩", region: "Middle East" },
  { code: "ar-SY", name: "العربية (سوريا)", nameEn: "Arabic (Syria)", flag: "🇸🇾", region: "Middle East" },

  // Bahasa tambahan lainnya
  { code: "dv", name: "ދިވެހި", nameEn: "Dhivehi", flag: "🇲🇻", region: "Asia" },
  { code: "bo", name: "བོད་སྐད", nameEn: "Tibetan", flag: "🇨🇳", region: "Asia" },
  { code: "ug", name: "ئۇيغۇرچە", nameEn: "Uyghur", flag: "🇨🇳", region: "Asia" },
  { code: "dz", name: "རྫོང་ཁ", nameEn: "Dzongkha", flag: "🇧🇹", region: "Asia" },
  { code: "ceb", name: "Cebuano", nameEn: "Cebuano", flag: "🇵🇭", region: "Asia" },
  { code: "ilo", name: "Ilokano", nameEn: "Ilocano", flag: "🇵🇭", region: "Asia" },
  { code: "hmn", name: "Hmoob", nameEn: "Hmong", flag: "🇱🇦", region: "Asia" },

  // Eropa tambahan
  { code: "fy", name: "Frysk", nameEn: "Frisian", flag: "🇳🇱", region: "Europe" },
  { code: "co", name: "Corsu", nameEn: "Corsican", flag: "🇫🇷", region: "Europe" },
  { code: "oc", name: "Occitan", nameEn: "Occitan", flag: "🇫🇷", region: "Europe" },
  { code: "br", name: "Brezhoneg", nameEn: "Breton", flag: "🇫🇷", region: "Europe" },
  { code: "sc", name: "Sardu", nameEn: "Sardinian", flag: "🇮🇹", region: "Europe" },

  // Afrika tambahan
  { code: "ts", name: "Xitsonga", nameEn: "Tsonga", flag: "🇿🇦", region: "Africa" },
  { code: "ss", name: "siSwati", nameEn: "Swati", flag: "🇸🇿", region: "Africa" },
  { code: "ve", name: "Tshivenḓa", nameEn: "Venda", flag: "🇿🇦", region: "Africa" },
  { code: "nr", name: "isiNdebele", nameEn: "Ndebele", flag: "🇿🇦", region: "Africa" },
  { code: "nso", name: "Sepedi", nameEn: "Northern Sotho", flag: "🇿🇦", region: "Africa" },
  { code: "rn", name: "Ikirundi", nameEn: "Kirundi", flag: "🇧🇮", region: "Africa" },
  { code: "kg", name: "Kikongo", nameEn: "Kongo", flag: "🇨🇩", region: "Africa" },
  { code: "tw", name: "Twi", nameEn: "Twi", flag: "🇬🇭", region: "Africa" },

  // Negara kecil / Karibia / lainnya  
  { code: "en-SG", name: "English (Singapore)", nameEn: "English (Singapore)", flag: "🇸🇬", region: "Asia" },
  { code: "en-ZA", name: "English (South Africa)", nameEn: "English (South Africa)", flag: "🇿🇦", region: "Africa" },
  { code: "en-IN", name: "English (India)", nameEn: "English (India)", flag: "🇮🇳", region: "Asia" },
  { code: "en-PH", name: "English (Philippines)", nameEn: "English (Philippines)", flag: "🇵🇭", region: "Asia" },
  { code: "en-KE", name: "English (Kenya)", nameEn: "English (Kenya)", flag: "🇰🇪", region: "Africa" },
  { code: "en-NG", name: "English (Nigeria)", nameEn: "English (Nigeria)", flag: "🇳🇬", region: "Africa" },
  { code: "en-GH", name: "English (Ghana)", nameEn: "English (Ghana)", flag: "🇬🇭", region: "Africa" },
  { code: "fr-BE", name: "Français (Belgique)", nameEn: "French (Belgium)", flag: "🇧🇪", region: "Europe" },
  { code: "fr-CH", name: "Français (Suisse)", nameEn: "French (Switzerland)", flag: "🇨🇭", region: "Europe" },
  { code: "de-AT", name: "Deutsch (Österreich)", nameEn: "German (Austria)", flag: "🇦🇹", region: "Europe" },
  { code: "de-CH", name: "Deutsch (Schweiz)", nameEn: "German (Switzerland)", flag: "🇨🇭", region: "Europe" },
  { code: "pt-AO", name: "Português (Angola)", nameEn: "Portuguese (Angola)", flag: "🇦🇴", region: "Africa" },
  { code: "pt-MZ", name: "Português (Moçambique)", nameEn: "Portuguese (Mozambique)", flag: "🇲🇿", region: "Africa" },
  { code: "fr-SN", name: "Français (Sénégal)", nameEn: "French (Senegal)", flag: "🇸🇳", region: "Africa" },
  { code: "fr-CI", name: "Français (Côte d'Ivoire)", nameEn: "French (Ivory Coast)", flag: "🇨🇮", region: "Africa" },
  { code: "fr-CM", name: "Français (Cameroun)", nameEn: "French (Cameroon)", flag: "🇨🇲", region: "Africa" },
  { code: "fr-CD", name: "Français (RD Congo)", nameEn: "French (DR Congo)", flag: "🇨🇩", region: "Africa" },
  { code: "fr-MG", name: "Français (Madagascar)", nameEn: "French (Madagascar)", flag: "🇲🇬", region: "Africa" },
  { code: "es-CU", name: "Español (Cuba)", nameEn: "Spanish (Cuba)", flag: "🇨🇺", region: "Americas" },
  { code: "es-DO", name: "Español (Rep. Dominicana)", nameEn: "Spanish (Dominican Republic)", flag: "🇩🇴", region: "Americas" },
  { code: "es-EC", name: "Español (Ecuador)", nameEn: "Spanish (Ecuador)", flag: "🇪🇨", region: "Americas" },
  { code: "es-GT", name: "Español (Guatemala)", nameEn: "Spanish (Guatemala)", flag: "🇬🇹", region: "Americas" },
  { code: "es-HN", name: "Español (Honduras)", nameEn: "Spanish (Honduras)", flag: "🇭🇳", region: "Americas" },
  { code: "es-CR", name: "Español (Costa Rica)", nameEn: "Spanish (Costa Rica)", flag: "🇨🇷", region: "Americas" },
  { code: "es-PA", name: "Español (Panamá)", nameEn: "Spanish (Panama)", flag: "🇵🇦", region: "Americas" },
  { code: "es-UY", name: "Español (Uruguay)", nameEn: "Spanish (Uruguay)", flag: "🇺🇾", region: "Americas" },
  { code: "es-PY", name: "Español (Paraguay)", nameEn: "Spanish (Paraguay)", flag: "🇵🇾", region: "Americas" },
  { code: "es-BO", name: "Español (Bolivia)", nameEn: "Spanish (Bolivia)", flag: "🇧🇴", region: "Americas" },
  { code: "es-NI", name: "Español (Nicaragua)", nameEn: "Spanish (Nicaragua)", flag: "🇳🇮", region: "Americas" },
  { code: "es-SV", name: "Español (El Salvador)", nameEn: "Spanish (El Salvador)", flag: "🇸🇻", region: "Americas" },
  { code: "es-PR", name: "Español (Puerto Rico)", nameEn: "Spanish (Puerto Rico)", flag: "🇵🇷", region: "Americas" },
];

export const REGIONS = ["Asia", "Europe", "Americas", "Africa", "Middle East", "Oceania"];

export function getLanguageByCode(code: string): LanguageOption | undefined {
  return LANGUAGES.find(l => l.code === code);
}

export function getBaseLanguageCode(code: string): string {
  // "ar-EG" -> "ar", "en-US" -> "en", "id" -> "id"
  return code.split("-")[0];
}
