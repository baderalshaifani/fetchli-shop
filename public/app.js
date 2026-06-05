// ===================================
// fetchli.shop — app.js
// ===================================

// ═══ DATA ═══
const T = {
  ar:{dir:'rtl',lang:'ar',
    nav:{home:'الرئيسية',blog:'المدونة',about:'من نحن',contact:'تواصل معنا'},
    hero:{badge:'🌟 تسوق وسافر بذكاء',title1:'قارن. اختر.',title2:'وفّر أكثر',sub:'اختر ما تريد ويساعدك المساعد الذكي في إيجاد أفضل الأسعار'},
    mode:{shopLabel:'تسوق',shopDesc:'منتجات، إلكترونيات، ملابس وأكثر',travelLabel:'سفر',travelDesc:'فنادق، سيارات ورحلات حول العالم'},
    search:{hotels:'🏨 فنادق',cars:'🚗 سيارات',flights:'✈️ طيران',destination:'الوجهة',destinationPlaceholder:'الرياض، دبي، مكة...',checkin:'الوصول',checkout:'المغادرة',pickup:'مكان الاستلام',pickupDate:'تاريخ الاستلام',returnDate:'الإرجاع',from:'من',to:'إلى',travelDate:'التاريخ',searchBtn:'🔍 قارن الآن',searchCars:'🔍 قارن السيارات',searchFlights:'🔍 ابحث عن رحلات'},
    stats:{s1:'منتج وفندق',s2:'دولة حول العالم',s3:'متوسط التوفير',s4:'مقارنة فورية'},
    trusted:'نقارن الأسعار من',
    shop:{
      deals:{title:'🔥 أفضل عروض التسوق',save:'خصم',items:[
        {cat:'إلكترونيات',title:'iPhone 15 Pro Max 256GB',price:'3,299 ر.س',savings:'15%',icon:'📱',bg:'#1a2a4a'},
        {cat:'ساعات',title:'Samsung Galaxy Watch 6',price:'899 ر.س',savings:'30%',icon:'⌚',bg:'#1a3a2a'},
        {cat:'أزياء',title:'حقيبة يد فاخرة جلد',price:'450 ر.س',savings:'40%',icon:'👜',bg:'#3a1a2a'},
        {cat:'عطور',title:'عطر رجالي فاخر 100ml',price:'320 ر.س',savings:'25%',icon:'🌸',bg:'#2a2a1a'},
      ]},
      articles:{title:'📖 مدونة التسوق',items:[
        {cat:'مراجعات',title:'مراجعة iPhone 15 Pro Max — هل يستحق السعر؟',date:'5 يونيو 2026',read:'7 دقائق',icon:'📱'},
        {cat:'نصائح',title:'كيف تتسوق على Amazon SA وتحصل على أفضل الأسعار',date:'3 يونيو 2026',read:'5 دقائق',icon:'🛍️'},
        {cat:'مقارنة',title:'Amazon مقابل AliExpress — أيهما أفضل للسوق السعودي؟',date:'1 يونيو 2026',read:'6 دقائق',icon:'⚖️'},
        {cat:'أزياء',title:'أفضل 10 حقائب نسائية بأسعار مناسبة في 2026',date:'28 مايو 2026',read:'5 دقائق',icon:'👜'},
      ]},
      sidebar:{searchTitle:'🔍 ابحث عن منتج',searchBtn:'ابحث الآن',searchPlaceholder:'اسم المنتج...',promoTitle:'🎯 عروض اليوم',promoSub:'خصومات حتى 60% على المنتجات',promoBtn:'استعرض العروض',destTitle:'🔥 الأكثر بحثاً',destinations:[
        {name:'iPhone 15',price:'خصم 15%',icon:'📱'},
        {name:'ساعات سامسونج',price:'خصم 30%',icon:'⌚'},
        {name:'أديداس سامبا',price:'خصم 20%',icon:'👟'},
        {name:'عطور فاخرة',price:'خصم 25%',icon:'🌸'},
        {name:'لابتوب Dell',price:'خصم 18%',icon:'💻'},
      ],tipTitle:'💡 نصيحة التسوق',tip:'قارن السعر على Amazon وAliExpress قبل الشراء. الفرق أحياناً يصل لـ 40% لنفس المنتج.'},
      steps:[
        {icon:'🔍',title:'ابحث أو ارفع صورة',desc:'اكتب اسم المنتج أو ارفع صورته وسيحلل المساعد طلبك'},
        {icon:'⚖️',title:'قارن الأسعار',desc:'نجلب الأسعار من Amazon وAliExpress وغيرها في ثوانٍ'},
        {icon:'🛒',title:'اشترِ بأفضل سعر',desc:'اختر العرض المناسب وأكمل الشراء على الموقع الرسمي بأمان'},
      ],
      chips:['⌚ ساعة رجالي','👜 شنطة شانيل','📱 iPhone 15','🌸 عطر نسائي','👟 أديداس سامبا'],
      chatLabel:'مساعد التسوق الذكي',
      chatPlaceholder:'اكتب اسم المنتج أو اسأل عن أي شيء...',
      chatGreet:'مرحباً! أنا fetchli 🛍️\nأرسل لي اسم أي منتج أو صورته وسأبحث لك في أفضل المتاجر فوراً.',
    },
    travel:{
      deals:{title:'🔥 أفضل عروض السفر',save:'وفّر',perNight:'/ ليلة',items:[
        {cat:'مكة المكرمة',title:'فندق قريب من الحرم',price:'250 ر.س',savings:'22%',icon:'🕌',bg:'#1a3a5c'},
        {cat:'دبي',title:'منتجع على البحر',price:'480 ر.س',savings:'35%',icon:'🌴',bg:'#1a4a3a'},
        {cat:'الرياض',title:'فندق بوتيك وسط المدينة',price:'320 ر.س',savings:'18%',icon:'🏙️',bg:'#3a1a1a'},
        {cat:'جدة',title:'شقة فندقية على الكورنيش',price:'290 ر.س',savings:'27%',icon:'🌃',bg:'#2a1a4a'},
      ]},
      articles:{title:'📖 مدونة السفر',items:[
        {cat:'دليل السفر',title:'أفضل 10 فنادق في مكة قريبة من الحرم وبأسعار معقولة 2026',date:'5 يونيو 2026',read:'8 دقائق',icon:'🕌'},
        {cat:'نصائح',title:'كيف توفر 40% على تأجير السيارات في دبي — دليل شامل',date:'3 يونيو 2026',read:'6 دقائق',icon:'🚗'},
        {cat:'مقارنات',title:'Booking.com مقابل Agoda — أيهما أرخص في السوق السعودي؟',date:'1 يونيو 2026',read:'5 دقائق',icon:'⚖️'},
        {cat:'وجهات',title:'العلا والطائف: وجهات الصيف الأكثر طلباً في 2026',date:'28 مايو 2026',read:'7 دقائق',icon:'🌴'},
      ]},
      sidebar:{searchTitle:'🔍 بحث سريع',searchBtn:'قارن الأسعار',searchPlaceholder:'الوجهة...',promoTitle:'🎯 عروض الصيف',promoSub:'وفّر حتى 40% على يوليو وأغسطس',promoBtn:'استعرض العروض',destTitle:'🌍 الأكثر بحثاً',destinations:[
        {name:'مكة المكرمة',price:'من 220 ر.س / ليلة',icon:'🕌'},
        {name:'دبي',price:'من 380 ر.س / ليلة',icon:'🌴'},
        {name:'الرياض',price:'من 280 ر.س / ليلة',icon:'🏙️'},
        {name:'جدة',price:'من 260 ر.س / ليلة',icon:'🌊'},
        {name:'الطائف',price:'من 180 ر.س / ليلة',icon:'🏔️'},
      ],tipTitle:'💡 نصيحة السفر',tip:'احجز الفنادق قبل 21 يوماً للحصول على أفضل الأسعار. الأسعار ترتفع 35% في الأسبوع الأخير.'},
      steps:[
        {icon:'🔍',title:'ابحث عن وجهتك',desc:'اكتب المدينة أو الفندق وتواريخ إقامتك وعدد الضيوف'},
        {icon:'⚖️',title:'قارن الأسعار',desc:'نجلب الأسعار من Booking وAgoda وExpedia وغيرها في ثوانٍ'},
        {icon:'✅',title:'احجز بأفضل سعر',desc:'اختر العرض المناسب وأكمل الحجز على الموقع الرسمي بأمان'},
      ],
      chips:['🏨 فنادق مكة','🚗 سيارات دبي','✈️ رحلات جدة','🌴 منتجعات العلا','🏖️ شرم الشيخ'],
      chatLabel:'مساعد السفر الذكي',
      chatPlaceholder:'اسأل عن فنادق، رحلات، أو وجهات...',
      chatGreet:'مرحباً! أنا مساعد سفر Fetchli ✈️\nاسألني عن فنادق، رحلات، أو تأجير سيارات.',
    },
    how:{title:'كيف يعمل Fetchli؟',sub:'ثلاث خطوات بسيطة للحصول على أفضل سعر'},
    footer:{desc:'محرك مقارنة أسعار التسوق والسفر في الخليج والعالم.',services:'الخدمات',serviceLinks:['مقارنة الفنادق','تأجير السيارات','منتجات التسوق','عروض حصرية'],company:'الشركة',companyLinks:['من نحن','المدونة','تواصل معنا'],legal:'القانونية',legalLinks:['سياسة الخصوصية','شروط الاستخدام'],copy:'© 2026 Fetchli. جميع الحقوق محفوظة.',tagline:'تسوق وسافر بذكاء'},
    pages:{
      privacy:{title:'سياسة الخصوصية',date:'آخر تحديث: 1 يونيو 2026',sections:[{h:'المعلومات التي نجمعها',p:'نجمع بيانات التصفح ونوع المتصفح وعنوان IP لتحسين تجربتك.'},{h:'ملفات الكوكيز',p:'نستخدم الكوكيز. المنصات الشريكة تستخدم كوكيزها الخاصة عند التوجيه إليها.'},{h:'مشاركة البيانات',p:'لا نبيع بياناتك. نوجهك للمنصات الشريكة عبر برامج الإحالة الرسمية.'},{h:'التواصل',p:'privacy@fetchli.shop'}]},
      terms:{title:'شروط الاستخدام',date:'آخر تحديث: 1 يونيو 2026',sections:[{h:'قبول الشروط',p:'باستخدامك الموقع توافق على هذه الشروط.'},{h:'طبيعة الخدمة',p:'Fetchli موقع مقارنة أسعار فقط. لا نجري حجوزات أو مشتريات مباشرة.'},{h:'الروابط الخارجية',p:'غير مسؤولين عن محتوى المواقع الشريكة أو سياساتها.'}]},
      about:{title:'من نحن',date:'',sections:[{h:'قصتنا',p:'Fetchli وُلد من فكرة بسيطة: لماذا يفتح المسافر والمتسوق 10 تبويبات ليجد أفضل سعر؟'},{h:'مهمتنا',p:'نجلب أفضل أسعار الفنادق والمنتجات وتأجير السيارات في مكان واحد ذكي.'},{h:'شركاؤنا',p:'Amazon • AliExpress • Booking.com • Agoda • Expedia • Localrent • Viator'}]},
      contact:{title:'تواصل معنا',date:'',sections:[{h:'البريد الإلكتروني',p:'📧 info@fetchli.shop\n📧 support@fetchli.shop'},{h:'للشراكات',p:'📧 partners@fetchli.shop'},{h:'وقت الاستجابة',p:'نرد خلال 24-48 ساعة في أيام العمل.'}]},
    }
  },
  en:{dir:'ltr',lang:'en',
    nav:{home:'Home',blog:'Blog',about:'About',contact:'Contact'},
    hero:{badge:'🌟 Shop & Travel Smart',title1:'Compare. Choose.',title2:'Save More',sub:'Choose what you need and let our AI find you the best prices'},
    mode:{shopLabel:'Shop',shopDesc:'Products, electronics, fashion & more',travelLabel:'Travel',travelDesc:'Hotels, cars & flights worldwide'},
    search:{hotels:'🏨 Hotels',cars:'🚗 Cars',flights:'✈️ Flights',destination:'Destination',destinationPlaceholder:'Riyadh, Dubai, London...',checkin:'Check-in',checkout:'Check-out',pickup:'Pickup',pickupDate:'Pickup Date',returnDate:'Return',from:'From',to:'To',travelDate:'Date',searchBtn:'🔍 Compare Now',searchCars:'🔍 Compare Cars',searchFlights:'🔍 Search Flights'},
    stats:{s1:'Products & Hotels',s2:'Countries Worldwide',s3:'Average Savings',s4:'Real-time Comparison'},
    trusted:'We compare prices from',
    shop:{
      deals:{title:'🔥 Best Shopping Deals',save:'Off',items:[
        {cat:'Electronics',title:'iPhone 15 Pro Max 256GB',price:'$879',savings:'15%',icon:'📱',bg:'#1a2a4a'},
        {cat:'Watches',title:'Samsung Galaxy Watch 6',price:'$239',savings:'30%',icon:'⌚',bg:'#1a3a2a'},
        {cat:'Fashion',title:'Luxury Leather Handbag',price:'$120',savings:'40%',icon:'👜',bg:'#3a1a2a'},
        {cat:'Fragrance',title:'Men\'s Luxury Perfume 100ml',price:'$85',savings:'25%',icon:'🌸',bg:'#2a2a1a'},
      ]},
      articles:{title:'📖 Shopping Blog',items:[
        {cat:'Reviews',title:'iPhone 15 Pro Max Review — Is It Worth the Price?',date:'June 5, 2026',read:'7 min',icon:'📱'},
        {cat:'Tips',title:'How to Shop on Amazon SA and Get the Best Prices',date:'June 3, 2026',read:'5 min',icon:'🛍️'},
        {cat:'Comparison',title:'Amazon vs AliExpress — Which is Better for Saudi Market?',date:'June 1, 2026',read:'6 min',icon:'⚖️'},
        {cat:'Fashion',title:'Top 10 Women\'s Handbags at Affordable Prices in 2026',date:'May 28, 2026',read:'5 min',icon:'👜'},
      ]},
      sidebar:{searchTitle:'🔍 Search Products',searchBtn:'Search Now',searchPlaceholder:'Product name...',promoTitle:'🎯 Today\'s Deals',promoSub:'Up to 60% off on products',promoBtn:'View Deals',destTitle:'🔥 Trending Searches',destinations:[
        {name:'iPhone 15',price:'15% off',icon:'📱'},
        {name:'Samsung Watches',price:'30% off',icon:'⌚'},
        {name:'Adidas Samba',price:'20% off',icon:'👟'},
        {name:'Luxury Perfumes',price:'25% off',icon:'🌸'},
        {name:'Dell Laptop',price:'18% off',icon:'💻'},
      ],tipTitle:'💡 Shopping Tip',tip:'Compare prices on Amazon and AliExpress before buying. The difference can reach 40% for the same product.'},
      steps:[
        {icon:'🔍',title:'Search or Upload Photo',desc:'Type a product name or upload a photo — our AI handles the rest'},
        {icon:'⚖️',title:'Compare Prices',desc:'We fetch prices from Amazon, AliExpress and more in seconds'},
        {icon:'🛒',title:'Buy at Best Price',desc:'Choose the best offer and complete your purchase securely'},
      ],
      chips:['⌚ Men\'s Watch','👜 Chanel Bag','📱 iPhone 15','🌸 Perfume','👟 Adidas Samba'],
      chatLabel:'AI Shopping Assistant',chatPlaceholder:'Type a product name or ask anything...',chatGreet:'Hello! I\'m Fetchli 🛍️\nSend me any product name or photo and I\'ll search the best stores instantly.',
    },
    travel:{
      deals:{title:'🔥 Best Travel Deals',save:'Save',perNight:'/ night',items:[
        {cat:'Mecca',title:'Hotel Near Haram',price:'$66',savings:'22%',icon:'🕌',bg:'#1a3a5c'},
        {cat:'Dubai',title:'Beachfront Resort',price:'$128',savings:'35%',icon:'🌴',bg:'#1a4a3a'},
        {cat:'Riyadh',title:'Boutique City Hotel',price:'$85',savings:'18%',icon:'🏙️',bg:'#3a1a1a'},
        {cat:'Jeddah',title:'Corniche Apartment',price:'$77',savings:'27%',icon:'🌃',bg:'#2a1a4a'},
      ]},
      articles:{title:'📖 Travel Blog',items:[
        {cat:'Guide',title:'Top 10 Hotels Near Haram in Mecca — Best Value 2026',date:'June 5, 2026',read:'8 min',icon:'🕌'},
        {cat:'Tips',title:'How to Save 40% on Car Rentals in Dubai — Full Guide',date:'June 3, 2026',read:'6 min',icon:'🚗'},
        {cat:'Comparison',title:'Booking.com vs Agoda — Which is Cheaper in Saudi Arabia?',date:'June 1, 2026',read:'5 min',icon:'⚖️'},
        {cat:'Destinations',title:'AlUla & Taif: Saudi Arabia\'s Top Summer Spots 2026',date:'May 28, 2026',read:'7 min',icon:'🌴'},
      ]},
      sidebar:{searchTitle:'🔍 Quick Search',searchBtn:'Compare Prices',searchPlaceholder:'Destination...',promoTitle:'🎯 Summer Deals',promoSub:'Save up to 40% on July & August',promoBtn:'View Deals',destTitle:'🌍 Popular Destinations',destinations:[
        {name:'Mecca',price:'From $60 / night',icon:'🕌'},
        {name:'Dubai',price:'From $100 / night',icon:'🌴'},
        {name:'Riyadh',price:'From $75 / night',icon:'🏙️'},
        {name:'Jeddah',price:'From $70 / night',icon:'🌊'},
        {name:'Taif',price:'From $48 / night',icon:'🏔️'},
      ],tipTitle:'💡 Travel Tip',tip:'Book hotels at least 21 days in advance. Prices rise 35% in the last week before arrival.'},
      steps:[
        {icon:'🔍',title:'Search Your Destination',desc:'Enter city or hotel, travel dates and number of guests'},
        {icon:'⚖️',title:'Compare Prices',desc:'We fetch prices from Booking, Agoda, Expedia and more in seconds'},
        {icon:'✅',title:'Book at Best Price',desc:'Choose the best offer and complete your booking securely'},
      ],
      chips:['🏨 Mecca Hotels','🚗 Dubai Cars','✈️ Jeddah Flights','🌴 AlUla Resorts','🏖️ Sharm El Sheikh'],
      chatLabel:'AI Travel Assistant',chatPlaceholder:'Ask about hotels, flights, or destinations...',chatGreet:'Hello! I\'m Fetchli\'s travel assistant ✈️\nAsk me about hotels, flights, or car rentals.',
    },
    how:{title:'How Fetchli Works',sub:'Three simple steps to the best price'},
    footer:{desc:'Shopping and travel price comparison for the Gulf and worldwide.',services:'Services',serviceLinks:['Hotel Comparison','Car Rental','Shopping','Exclusive Deals'],company:'Company',companyLinks:['About Us','Blog','Contact'],legal:'Legal',legalLinks:['Privacy Policy','Terms of Use'],copy:'© 2026 Fetchli. All rights reserved.',tagline:'Shop & Travel Smart'},
    pages:{
      privacy:{title:'Privacy Policy',date:'Last updated: June 1, 2026',sections:[{h:'Data We Collect',p:'We collect browsing data, browser type, and IP address to improve your experience.'},{h:'Cookies',p:'We use cookies. Partner platforms use their own cookies when redirected.'},{h:'Data Sharing',p:'We do not sell your data. Users are directed to partners via official affiliate programs.'},{h:'Contact',p:'privacy@fetchli.shop'}]},
      terms:{title:'Terms of Use',date:'Last updated: June 1, 2026',sections:[{h:'Acceptance',p:'By using Fetchli, you agree to these terms.'},{h:'Nature of Service',p:'Fetchli is a price comparison site. We do not make direct bookings or purchases.'},{h:'External Links',p:'We are not responsible for partner site content or policies.'}]},
      about:{title:'About Us',date:'',sections:[{h:'Our Story',p:'Fetchli was born from a simple idea: why open 10 tabs to find the best price?'},{h:'Our Mission',p:'We bring together the best hotel, car, and shopping prices in one smart place.'},{h:'Our Partners',p:'Amazon • AliExpress • Booking.com • Agoda • Expedia • Localrent • Viator'}]},
      contact:{title:'Contact Us',date:'',sections:[{h:'Email',p:'📧 info@fetchli.shop\n📧 support@fetchli.shop'},{h:'Partnerships',p:'📧 partners@fetchli.shop'},{h:'Response Time',p:'We respond within 24-48 hours on business days.'}]},
    }
  },
  de:{dir:'ltr',lang:'de',
    nav:{home:'Startseite',blog:'Blog',about:'Über uns',contact:'Kontakt'},
    hero:{badge:'🌟 Smart shoppen & reisen',title1:'Vergleichen. Wählen.',title2:'Mehr sparen',sub:'Wählen Sie was Sie brauchen und lassen Sie unsere KI die besten Preise finden'},
    mode:{shopLabel:'Shoppen',shopDesc:'Produkte, Elektronik, Mode & mehr',travelLabel:'Reisen',travelDesc:'Hotels, Autos & Flüge weltweit'},
    search:{hotels:'🏨 Hotels',cars:'🚗 Mietwagen',flights:'✈️ Flüge',destination:'Ziel',destinationPlaceholder:'Riad, Dubai, Berlin...',checkin:'Anreise',checkout:'Abreise',pickup:'Abholort',pickupDate:'Abholdatum',returnDate:'Rückgabe',from:'Von',to:'Nach',travelDate:'Datum',searchBtn:'🔍 Jetzt vergleichen',searchCars:'🔍 Autos vergleichen',searchFlights:'🔍 Flüge suchen'},
    stats:{s1:'Produkte & Hotels',s2:'Länder weltweit',s3:'Ø Ersparnis',s4:'Echtzeit-Vergleich'},
    trusted:'Wir vergleichen Preise von',
    shop:{
      deals:{title:'🔥 Beste Shopping-Angebote',save:'Rabatt',items:[
        {cat:'Elektronik',title:'iPhone 15 Pro Max 256GB',price:'€829',savings:'15%',icon:'📱',bg:'#1a2a4a'},
        {cat:'Uhren',title:'Samsung Galaxy Watch 6',price:'€225',savings:'30%',icon:'⌚',bg:'#1a3a2a'},
        {cat:'Mode',title:'Luxus-Lederhandtasche',price:'€113',savings:'40%',icon:'👜',bg:'#3a1a2a'},
        {cat:'Parfüm',title:'Herrenparfüm Luxus 100ml',price:'€80',savings:'25%',icon:'🌸',bg:'#2a2a1a'},
      ]},
      articles:{title:'📖 Shopping-Blog',items:[
        {cat:'Bewertungen',title:'iPhone 15 Pro Max Test — Lohnt sich der Preis?',date:'5. Juni 2026',read:'7 Min.',icon:'📱'},
        {cat:'Tipps',title:'Wie man bei Amazon SA einkauft und die besten Preise bekommt',date:'3. Juni 2026',read:'5 Min.',icon:'🛍️'},
        {cat:'Vergleich',title:'Amazon vs. AliExpress — Was ist besser für den Saudi-Markt?',date:'1. Juni 2026',read:'6 Min.',icon:'⚖️'},
        {cat:'Mode',title:'Top 10 Damenhandtaschen zu erschwinglichen Preisen 2026',date:'28. Mai 2026',read:'5 Min.',icon:'👜'},
      ]},
      sidebar:{searchTitle:'🔍 Produkt suchen',searchBtn:'Jetzt suchen',searchPlaceholder:'Produktname...',promoTitle:'🎯 Tagesangebote',promoSub:'Bis zu 60% Rabatt auf Produkte',promoBtn:'Angebote ansehen',destTitle:'🔥 Trendsuchen',destinations:[
        {name:'iPhone 15',price:'15% Rabatt',icon:'📱'},
        {name:'Samsung Uhren',price:'30% Rabatt',icon:'⌚'},
        {name:'Adidas Samba',price:'20% Rabatt',icon:'👟'},
        {name:'Luxusparfüm',price:'25% Rabatt',icon:'🌸'},
        {name:'Dell Laptop',price:'18% Rabatt',icon:'💻'},
      ],tipTitle:'💡 Shopping-Tipp',tip:'Vergleichen Sie Preise auf Amazon und AliExpress vor dem Kauf. Der Unterschied kann 40% betragen.'},
      steps:[
        {icon:'🔍',title:'Suchen oder Foto hochladen',desc:'Produktname eingeben oder Foto hochladen — unsere KI erledigt den Rest'},
        {icon:'⚖️',title:'Preise vergleichen',desc:'Wir holen Preise von Amazon, AliExpress und mehr in Sekunden'},
        {icon:'🛒',title:'Zum besten Preis kaufen',desc:'Wählen Sie das beste Angebot und kaufen Sie sicher ein'},
      ],
      chips:['⌚ Herrenuhr','👜 Chanel Tasche','📱 iPhone 15','🌸 Parfüm','👟 Adidas Samba'],
      chatLabel:'KI-Shopping-Assistent',chatPlaceholder:'Produktname eingeben oder fragen...',chatGreet:'Hallo! Ich bin Fetchli 🛍️\nSenden Sie mir einen Produktnamen oder ein Foto und ich suche sofort die besten Preise.',
    },
    travel:{
      deals:{title:'🔥 Beste Reiseangebote',save:'Spare',perNight:'/ Nacht',items:[
        {cat:'Mekka',title:'Hotel nahe Haram',price:'€62',savings:'22%',icon:'🕌',bg:'#1a3a5c'},
        {cat:'Dubai',title:'Strandresort',price:'€120',savings:'35%',icon:'🌴',bg:'#1a4a3a'},
        {cat:'Riad',title:'Boutique-Stadthotel',price:'€80',savings:'18%',icon:'🏙️',bg:'#3a1a1a'},
        {cat:'Dschidda',title:'Corniche-Apartment',price:'€72',savings:'27%',icon:'🌃',bg:'#2a1a4a'},
      ]},
      articles:{title:'📖 Reise-Blog',items:[
        {cat:'Reiseführer',title:'Top 10 Hotels nahe Haram in Mekka — Bestes Preis-Leistungs 2026',date:'5. Juni 2026',read:'8 Min.',icon:'🕌'},
        {cat:'Tipps',title:'Wie Sie 40% bei Mietwagen in Dubai sparen — vollständiger Leitfaden',date:'3. Juni 2026',read:'6 Min.',icon:'🚗'},
        {cat:'Vergleich',title:'Booking.com vs. Agoda — Was ist günstiger in Saudi-Arabien?',date:'1. Juni 2026',read:'5 Min.',icon:'⚖️'},
        {cat:'Reiseziele',title:'AlUla & Taif: Saudi-Arabiens beliebteste Sommerziele 2026',date:'28. Mai 2026',read:'7 Min.',icon:'🌴'},
      ]},
      sidebar:{searchTitle:'🔍 Schnellsuche',searchBtn:'Preise vergleichen',searchPlaceholder:'Reiseziel...',promoTitle:'🎯 Sommerangebote',promoSub:'Spare bis zu 40% im Juli & August',promoBtn:'Angebote ansehen',destTitle:'🌍 Beliebte Ziele',destinations:[
        {name:'Mekka',price:'Ab €58 / Nacht',icon:'🕌'},
        {name:'Dubai',price:'Ab €95 / Nacht',icon:'🌴'},
        {name:'Riad',price:'Ab €70 / Nacht',icon:'🏙️'},
        {name:'Dschidda',price:'Ab €65 / Nacht',icon:'🌊'},
        {name:'Taif',price:'Ab €45 / Nacht',icon:'🏔️'},
      ],tipTitle:'💡 Reise-Tipp',tip:'Buchen Sie Hotels mindestens 21 Tage im Voraus. Preise steigen in der letzten Woche um 35%.'},
      steps:[
        {icon:'🔍',title:'Ziel suchen',desc:'Stadt oder Hotel, Reisedaten und Gästeanzahl eingeben'},
        {icon:'⚖️',title:'Preise vergleichen',desc:'Wir holen Preise von Booking, Agoda, Expedia und mehr'},
        {icon:'✅',title:'Zum besten Preis buchen',desc:'Wählen Sie das beste Angebot und buchen Sie sicher'},
      ],
      chips:['🏨 Hotels Mekka','🚗 Mietwagen Dubai','✈️ Flüge Dschidda','🌴 Resorts AlUla','🏖️ Sharm el-Sheikh'],
      chatLabel:'KI-Reise-Assistent',chatPlaceholder:'Nach Hotels, Flügen oder Zielen fragen...',chatGreet:'Hallo! Ich bin Fetchlis Reise-Assistent ✈️\nFragen Sie mich nach Hotels, Flügen oder Mietwagen.',
    },
    how:{title:'Wie Fetchli funktioniert',sub:'Drei einfache Schritte zum besten Preis'},
    footer:{desc:'Shopping- und Reisepreisvergleich für den Golfraum und weltweit.',services:'Dienste',serviceLinks:['Hotelvergleich','Mietwagen','Shopping','Exklusive Angebote'],company:'Unternehmen',companyLinks:['Über uns','Blog','Kontakt'],legal:'Rechtliches',legalLinks:['Datenschutz','Nutzungsbedingungen'],copy:'© 2026 Fetchli. Alle Rechte vorbehalten.',tagline:'Smart shoppen & reisen'},
    pages:{
      privacy:{title:'Datenschutzerklärung',date:'Zuletzt aktualisiert: 1. Juni 2026',sections:[{h:'Gesammelte Daten',p:'Wir sammeln Browserdaten, Browsertyp und IP-Adresse.'},{h:'Cookies',p:'Unsere Website verwendet Cookies. Partnerplattformen nutzen eigene Cookies.'},{h:'Datenweitergabe',p:'Wir verkaufen keine Daten. Nutzer werden über offizielle Partnerprogramme weitergeleitet.'},{h:'Kontakt',p:'privacy@fetchli.shop'}]},
      terms:{title:'Nutzungsbedingungen',date:'Zuletzt aktualisiert: 1. Juni 2026',sections:[{h:'Akzeptanz',p:'Mit der Nutzung von Fetchli stimmen Sie diesen Bedingungen zu.'},{h:'Dienstleistung',p:'Fetchli ist ein Preisvergleichsportal. Wir nehmen keine direkten Buchungen vor.'},{h:'Externe Links',p:'Wir haften nicht für Inhalte oder Richtlinien von Partnerseiten.'}]},
      about:{title:'Über uns',date:'',sections:[{h:'Unsere Geschichte',p:'Fetchli entstand aus einer einfachen Idee: Warum 10 Tabs öffnen für den besten Preis?'},{h:'Unsere Mission',p:'Wir bringen die besten Hotel-, Auto- und Shopping-Preise an einem Ort zusammen.'},{h:'Unsere Partner',p:'Amazon • AliExpress • Booking.com • Agoda • Expedia • Localrent • Viator'}]},
      contact:{title:'Kontakt',date:'',sections:[{h:'E-Mail',p:'📧 info@fetchli.shop\n📧 support@fetchli.shop'},{h:'Partnerschaften',p:'📧 partners@fetchli.shop'},{h:'Antwortzeit',p:'Wir antworten innerhalb von 24-48 Stunden an Werktagen.'}]},
    }
  }
};

// ═══ I18n ═══
const I18n = {
  current:'ar',
  detect(){const s=localStorage.getItem('fl');if(s&&T[s])return s;const n=navigator.language?.split('-')[0];return T[n]?n:'ar';},
  set(l){if(!T[l])return;this.current=l;localStorage.setItem('fl',l);this.apply();},
  apply(){
    const t=T[this.current];
    document.documentElement.dir=t.dir;document.documentElement.lang=t.lang;
    document.querySelectorAll('[data-i18n]').forEach(el=>{
      const v=el.dataset.i18n.split('.').reduce((o,k)=>o?.[k],t);
      if(v!==undefined)el.textContent=v;
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el=>{
      const v=el.dataset.i18nPh.split('.').reduce((o,k)=>o?.[k],t);
      if(v!==undefined)el.placeholder=v;
    });
    document.querySelectorAll('.lang-btn').forEach(b=>b.classList.toggle('active',b.dataset.lang===this.current));
    renderAll();
  },
  init(){this.current=this.detect();this.apply();}
};

// ═══ STATE ═══
let currentMode='shop';
const API='';
let userLocation={country:'SA',market:'SA',currency:'SAR',flag:'🇸🇦',name:'السعودية'};

// ═══ SET MODE ═══
function setMode(mode){
  currentMode=mode;
  const t=T[I18n.current];
  const isShop=mode==='shop';

  // cards
  document.getElementById('shopCard').className='mode-card shop-card'+(isShop?' active-shop':'');
  document.getElementById('travelCard').className='mode-card travel-card'+(!isShop?' active-travel':'');

  // bg
  const bg=document.getElementById('heroBg');
  bg.className='hero-bg '+(isShop?'shop':'travel');

  // accent color
  document.getElementById('heroAccent').style.color=isShop?'var(--shop)':'var(--teal)';

  // chat always visible - just update content
  {
    document.getElementById('chatModeLabel').textContent=isShop?t.shop.chatLabel:t.travel.chatLabel;
    document.getElementById('msgInput').placeholder=isShop?t.shop.chatPlaceholder:t.travel.chatPlaceholder;
    document.getElementById('sendBtn').className=isShop?'send-btn shop-send':'send-btn travel-send';
    document.getElementById('chatArea').innerHTML='';
    addMessage('ai',isShop?t.shop.chatGreet:t.travel.chatGreet,false);
  }

  renderAll();
}

// ═══ RENDER ALL ═══
function renderAll(){
  const t=T[I18n.current];
  const m=t[currentMode];
  if(!m)return;

  // section titles
  const dt=document.getElementById('deals-title');
  const at=document.getElementById('articles-title');
  const titleClass=currentMode==='shop'?'section-title shop-title':'section-title travel-title';
  if(dt){dt.className=titleClass;dt.innerHTML=`<span></span>${m.deals.title}`;}
  if(at){at.className=titleClass;at.innerHTML=`<span></span>${m.articles.title}`;}

  // deals
  const dg=document.getElementById('deals-grid');
  if(dg){
    const locClass=currentMode==='shop'?'shop-loc':'travel-loc';
    const cardClass=currentMode==='shop'?'shop-card':'travel-card';
    dg.innerHTML=m.deals.items.map(d=>`
      <a href="#" class="deal-card ${cardClass}">
        <div class="deal-thumb" style="background:linear-gradient(135deg,${d.bg},#060A14)">${d.icon}</div>
        <div class="deal-body">
          <div class="deal-location ${locClass}">${d.cat}</div>
          <div class="deal-title">${d.title}</div>
          <div class="deal-meta">
            <div class="deal-price">${d.price}${m.deals.perNight?`<small> ${m.deals.perNight}</small>`:''}</div>
            <div class="deal-savings">${m.deals.save} ${d.savings}</div>
          </div>
        </div>
      </a>`).join('');
  }

  // articles
  const al=document.getElementById('articles-list');
  if(al){
    const catClass=currentMode==='shop'?'shop-cat':'travel-cat';
    const artClass=currentMode==='shop'?'shop-article':'travel-article';
    al.innerHTML=m.articles.items.map(a=>`
      <a href="#" class="article-card ${artClass}">
        <div class="article-thumb">${a.icon}</div>
        <div>
          <div class="article-category ${catClass}">${a.cat}</div>
          <div class="article-title">${a.title}</div>
          <div class="article-meta">${a.date} · ${a.read}</div>
        </div>
      </a>`).join('');
  }

  // sidebar
  const sb=m.sidebar;
  const qf=document.getElementById('sidebar-search-form');
  const btnClass=currentMode==='shop'?'qsearch-btn shop-qbtn':'qsearch-btn travel-qbtn';
  document.getElementById('sidebar-search-title').textContent=sb.searchTitle;
  if(qf)qf.innerHTML=`
    <input type="text" placeholder="${sb.searchPlaceholder}">
    <input type="date">
    <button class="${btnClass}">${sb.searchBtn}</button>`;

  // promo
  const pb=document.getElementById('promo-banner');
  if(pb){
    pb.className=`promo-banner ${currentMode==='shop'?'shop-promo':'travel-promo'}`;
    document.getElementById('promo-title').textContent=sb.promoTitle;
    document.getElementById('promo-sub').textContent=sb.promoSub;
    const pbtn=document.getElementById('promo-btn');
    pbtn.textContent=sb.promoBtn;
    pbtn.className=`promo-btn ${currentMode==='shop'?'shop-pbtn':'travel-pbtn'}`;
  }

  // destinations
  document.getElementById('sidebar-dest-title').textContent=sb.destTitle;
  const dl=document.getElementById('dest-list');
  if(dl){
    const priceClass=currentMode==='shop'?'shop-price':'travel-price';
    dl.innerHTML=sb.destinations.map(d=>`
      <div class="dest-item">
        <div class="dest-icon">${d.icon}</div>
        <div class="dest-info">
          <div class="dest-name">${d.name}</div>
          <div class="dest-price ${priceClass}">${d.price}</div>
        </div>
        <div style="color:var(--muted);font-size:11px">←</div>
      </div>`).join('');
  }

  // tip
  document.getElementById('tip-title').textContent=sb.tipTitle;
  document.getElementById('tip-text').textContent=sb.tip;

  // steps
  const sg=document.getElementById('steps-grid');
  if(sg){
    const numClass=currentMode==='shop'?'step-num shop-num':'step-num travel-num';
    sg.innerHTML=m.steps.map((s,i)=>`
      <div class="step-card">
        <div class="${numClass}">${i+1}</div>
        <div class="step-icon">${s.icon}</div>
        <div class="step-title">${s.title}</div>
        <div class="step-desc">${s.desc}</div>
      </div>`).join('');
  }

  // chips
  const cr=document.getElementById('chipsRow');
  if(cr&&m.chips){
    const chipClass=currentMode==='travel'?'chip travel-chip':'chip';
    cr.innerHTML=m.chips.map(c=>`<button class="${chipClass}" onclick="sendMessage('${c.replace(/'/g,"\\'")}',null)">${c}</button>`).join('');
  }

  // footer
  const fs=document.getElementById('footer-services');
  if(fs)fs.innerHTML=t.footer.serviceLinks.map(l=>`<li><a href="#">${l}</a></li>`).join('');
  const fc=document.getElementById('footer-company');
  if(fc)fc.innerHTML=`<li><a onclick="showPage('about')">${t.footer.companyLinks[0]}</a></li><li><a onclick="showPage('blog')">${t.footer.companyLinks[1]}</a></li><li><a onclick="showPage('contact')">${t.footer.companyLinks[2]}</a></li>`;
  const fl=document.getElementById('footer-legal');
  if(fl)fl.innerHTML=`<li><a onclick="showPage('privacy')">${t.footer.legalLinks[0]}</a></li><li><a onclick="showPage('terms')">${t.footer.legalLinks[1]}</a></li>`;
}

// ═══ CHAT ═══
async function detectLocation(){
  try{const r=await fetch(`${API}/api/location`);userLocation=await r.json();document.getElementById('locName').textContent=userLocation.name||userLocation.country;}catch(e){}
}

function handleSend(){const v=document.getElementById('msgInput').value.trim();if(v)sendMessage(v,null);}

async function sendMessage(text,imageBase64){
  if(!text&&!imageBase64)return;
  const wantCheaper=text&&/أرخص|رخيص|بديل|cheaper|budget|alternative/i.test(text);
  addMessage('user',imageBase64?`📸 ${text||''}`:text,true);
  document.getElementById('msgInput').value='';
  showTyping();
  try{
    const ar=await fetch(`${API}/api/analyze`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,imageBase64,wantCheaper})});
    const analyzed=await ar.json();
    const sr=await fetch(`${API}/api/search`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({queries:analyzed.searchQueries||[text],market:userLocation.market||'SA',wantCheaper})});
    const {products}=await sr.json();
    let final=products;
    if(products?.length>3&&analyzed.productType){
      try{const fr=await fetch(`${API}/api/filter`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({products,originalAnalysis:analyzed,wantCheaper})});const fd=await fr.json();if(fd.products?.length)final=fd.products;}catch(e){}
    }
    removeTyping();
    addMessage('ai',analyzed.reply||(I18n.current==='ar'?`وجدت ${final.length} نتائج`:`Found ${final.length} results`),false);
    if(final?.length)addProducts(final);
  }catch(err){removeTyping();addMessage('ai',I18n.current==='ar'?'❌ حدث خطأ، حاول مرة ثانية':'❌ An error occurred',false);}
}

function addMessage(role,text,isUser){
  const chat=document.getElementById('chatArea');
  const row=document.createElement('div');
  row.className=`msg-row ${role}`;
  const bubbleClass=isUser?`msg-bubble user${currentMode==='travel'?' travel-mode':''}`:'msg-bubble ai';
  const avatarClass=`msg-avatar ${role}${!isUser&&currentMode==='travel'?' travel-mode':''}`;
  row.innerHTML=`<div class="${avatarClass}">${role==='ai'?'✦':'👤'}</div><div class="${bubbleClass}">${text.replace(/\n/g,'<br>')}</div>`;
  chat.appendChild(row);chat.scrollTop=chat.scrollHeight;
}

function addImagePreview(src){
  const chat=document.getElementById('chatArea');
  const row=document.createElement('div');
  row.className='msg-row user';
  row.innerHTML=`<div class="msg-avatar user">👤</div><img src="${src}" class="img-preview">`;
  chat.appendChild(row);chat.scrollTop=chat.scrollHeight;
}

function addProducts(products){
  const chat=document.getElementById('chatArea');
  const grid=document.createElement('div');
  grid.className='products-grid';
  const buyClass=currentMode==='travel'?'btn-buy travel-buy':'btn-buy shop-buy';
  const buyLabel=I18n.current==='ar'?(currentMode==='travel'?'احجز ←':'شراء ←'):(currentMode==='travel'?'Book →':'Buy →');
  grid.innerHTML=products.slice(0,4).map(p=>`
    <div class="product-card">
      <img src="${p.image}" class="product-img" alt="${p.name}" onerror="this.style.display='none'">
      <div class="product-body">
        <div class="product-name">${p.name.slice(0,45)}</div>
        <div class="product-store">${p.store||''}</div>
        <div class="product-price">${p.price}</div>
        <a class="${buyClass}" href="${p.url}" target="_blank" rel="noopener">${buyLabel}</a>
      </div>
    </div>`).join('');
  chat.appendChild(grid);chat.scrollTop=chat.scrollHeight;
}

function showTyping(){
  const chat=document.getElementById('chatArea');
  const el=document.createElement('div');
  el.id='typing';el.className='msg-row ai';
  el.innerHTML=`<div class="msg-avatar ai${currentMode==='travel'?' travel-mode':''}">✦</div><div><div class="typing-bubble"><span></span><span></span><span></span></div><div class="typing-label" id="typingLabel">...</div></div>`;
  chat.appendChild(el);chat.scrollTop=chat.scrollHeight;
}
function removeTyping(){document.getElementById('typing')?.remove();}

function switchTab(btn,type){
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  ['hotels','cars','flights'].forEach(t=>{const f=document.getElementById(t+'-form');if(f)f.style.display=t===type?'grid':'none';});
}

// ═══ PAGES ═══
function showPage(page){
  document.getElementById('home-content').style.display=page==='home'?'block':'none';
  document.querySelectorAll('.page-section').forEach(el=>el.classList.remove('active'));
  if(page!=='home'){const el=document.getElementById(page+'-page');if(el){el.classList.add('active');renderPage(page);}}
  window.scrollTo(0,0);
}

function renderPage(page){
  const t=T[I18n.current];
  const el=document.getElementById(page+'-page');
  if(!el)return;
  if(page==='blog'){
    const bgs=['#1a2a4a','#1a4a3a','#3a1a2a','#2a2a1a','#1a3a5c','#3a1a1a'];
    const items=[...t.shop.articles.items,...t.travel.articles.items];
    el.innerHTML=`<h1 style="font-size:26px;font-weight:900;margin-bottom:6px">${t.nav.blog}</h1><p class="page-date" style="margin-bottom:20px"></p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
    ${items.map((a,i)=>`<a href="#" class="deal-card" style="text-decoration:none">
      <div class="deal-thumb" style="background:linear-gradient(135deg,${bgs[i%6]},#060A14)">${a.icon}</div>
      <div class="deal-body"><div class="deal-location" style="color:var(--primary)">${a.cat}</div><div class="deal-title">${a.title}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:6px">${a.date} · ${a.read}</div></div></a>`).join('')}
    </div>`;
    return;
  }
  const pd=t.pages[page];
  if(!pd)return;
  el.innerHTML=`<h1>${pd.title}</h1>${pd.date?`<p class="page-date">${pd.date}</p>`:''}${pd.sections.map(s=>`<h2>${s.h}</h2><p>${s.p}</p>`).join('')}`;
}

// ═══ INIT ═══
document.addEventListener('DOMContentLoaded',()=>{
  I18n.init();
  detectLocation();
  setMode('shop');
  document.getElementById('msgInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();}});
  document.getElementById('imageInput').addEventListener('change',e=>{
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=ev=>{addImagePreview(ev.target.result);sendMessage(I18n.current==='ar'?'أبي منتجات مشابهة':'Find similar products',ev.target.result.split(',')[1]);};
    r.readAsDataURL(f);
  });
});