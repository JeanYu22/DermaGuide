/* ===========================================================================
 * Lightweight i18n. English is the default; switcher covers Chinese, Korean,
 * French, Indonesian, Japanese, Arabic (RTL). Translations are AI-generated as
 * a starting point — refine wording as needed.
 *
 * Usage in HTML:  <span data-i18n="key"></span>   <input data-i18n-ph="key">
 * Usage in JS:    t('key')
 * ======================================================================== */
(function () {
  const STRINGS = {
    en: {
      tagline: 'Your Organic Skincare Sanctuary',
      enter_store: 'Enter Store', quick_analysis: 'Quick Skin Analysis', sign_in: 'Sign In',
      nav_shop: 'Shop', nav_chat: 'Chat', nav_analyze: 'Analyze',
      qa_consult: 'Consultation', qa_scan: 'Skin Scan', qa_tips: 'Skincare Tips', qa_shopall: 'Shop All',
      shop_title: 'Shop Products', search_ph: 'Search products…', tips_title: 'Expert Tips',
      chat_title: 'Lily · Skincare Consultant', chat_ph: 'Type your message…',
      analyzer_title: 'AI Skin Analysis', upload_title: 'Upload Your Photo', upload_text: 'Face, hands, arms, legs — any body part!',
      add_cart: 'Add to Cart', checkout: 'Checkout', place_order: 'Place Order',
      looks_accurate: '✓ Looks accurate', adjust_scores: '✎ Adjust scores',
      hero_title: 'Know your skin. Care with confidence.',
      hero_sub: 'AI-powered skin analysis and personalised organic skincare — guided by Lily, your virtual consultant.',
      get_started: 'Get Started', how_it_works: 'How it works',
      benefit1_t: 'Analyze any skin', benefit1_d: 'Snap a photo of your face, hands, legs or back. Our AI scores your skin and flags anything that needs a doctor.',
      benefit2_t: 'Personalised picks', benefit2_d: 'Get organic, vegan products chosen for your concerns — with the reason and how to use each one.',
      benefit3_t: 'Talk to Lily', benefit3_d: 'Chat anytime with your AI skincare consultant for friendly, practical advice.',
      mission_t: 'Our Mission', mission_d: 'Make trustworthy, personalised skincare accessible to everyone — combining dermatology-aware AI with clean, certified products.',
      vision_t: 'Our Vision', vision_d: 'A world where caring for your skin is simple, science-guided, and kind to the planet.',
      meet_lily: 'Hi, I\'m Lily 👋', lily_intro: 'Your AI skincare nurse. Ready to analyze your skin and find what truly works for you.',
    },
    zh: {
      tagline: '你的有机护肤圣地',
      enter_store: '进入商店', quick_analysis: '快速肤质分析', sign_in: '登录',
      nav_shop: '商店', nav_chat: '咨询', nav_analyze: '分析',
      qa_consult: '咨询', qa_scan: '肌肤扫描', qa_tips: '护肤贴士', qa_shopall: '全部商品',
      shop_title: '选购产品', search_ph: '搜索产品…', tips_title: '专家贴士',
      chat_title: 'Lily · 护肤顾问', chat_ph: '输入您的信息…',
      analyzer_title: 'AI 肌肤分析', upload_title: '上传照片', upload_text: '面部、手、手臂、腿——任何部位！',
      add_cart: '加入购物车', checkout: '结账', place_order: '提交订单',
      looks_accurate: '✓ 准确', adjust_scores: '✎ 调整评分',
      hero_title: '了解你的肌肤，自信护理。',
      hero_sub: '由你的虚拟顾问 Lily 引导，提供 AI 肌肤分析与个性化有机护肤。',
      get_started: '立即开始', how_it_works: '使用方法',
      benefit1_t: '分析任何肌肤', benefit1_d: '拍下面部、手、腿或背部，AI 为你的肌肤评分，并提示需要就医的情况。',
      benefit2_t: '个性化推荐', benefit2_d: '为你的需求挑选有机、纯素产品——并说明推荐理由与使用方法。',
      benefit3_t: '与 Lily 对话', benefit3_d: '随时与 AI 护肤顾问交流，获得友好实用的建议。',
      mission_t: '我们的使命', mission_d: '让可信赖的个性化护肤惠及每个人——结合具皮肤科意识的 AI 与纯净认证产品。',
      vision_t: '我们的愿景', vision_d: '让护理肌肤变得简单、有科学依据且对地球友善。',
      meet_lily: '你好，我是 Lily 👋', lily_intro: '你的 AI 护肤护士，随时为你分析肌肤，找到真正适合你的方案。',
    },
    ko: {
      tagline: '당신의 유기농 스킨케어 안식처',
      enter_store: '스토어 입장', quick_analysis: '빠른 피부 분석', sign_in: '로그인',
      nav_shop: '쇼핑', nav_chat: '상담', nav_analyze: '분석',
      qa_consult: '상담', qa_scan: '피부 스캔', qa_tips: '스킨케어 팁', qa_shopall: '전체 상품',
      shop_title: '제품 쇼핑', search_ph: '제품 검색…', tips_title: '전문가 팁',
      chat_title: 'Lily · 스킨케어 상담사', chat_ph: '메시지를 입력하세요…',
      analyzer_title: 'AI 피부 분석', upload_title: '사진 업로드', upload_text: '얼굴, 손, 팔, 다리 — 어느 부위든!',
      add_cart: '장바구니 담기', checkout: '결제', place_order: '주문하기',
      looks_accurate: '✓ 정확해요', adjust_scores: '✎ 점수 조정',
      hero_title: '내 피부를 알고, 자신 있게 관리하세요.',
      hero_sub: '가상 상담사 Lily가 안내하는 AI 피부 분석과 맞춤 유기농 스킨케어.',
      get_started: '시작하기', how_it_works: '이용 방법',
      benefit1_t: '모든 피부 분석', benefit1_d: '얼굴, 손, 다리, 등을 촬영하면 AI가 피부를 평가하고 진료가 필요한 부분을 알려줍니다.',
      benefit2_t: '맞춤 추천', benefit2_d: '고민에 맞춘 유기농·비건 제품을 추천하고 이유와 사용법을 알려드립니다.',
      benefit3_t: 'Lily와 대화', benefit3_d: 'AI 스킨케어 상담사와 언제든 친근하고 실용적인 조언을 나누세요.',
      mission_t: '우리의 미션', mission_d: '피부과 지식을 갖춘 AI와 깨끗한 인증 제품으로 신뢰할 수 있는 맞춤 스킨케어를 모두에게.',
      vision_t: '우리의 비전', vision_d: '피부 관리가 간단하고 과학적이며 지구에 친절한 세상.',
      meet_lily: '안녕하세요, Lily예요 👋', lily_intro: '당신의 AI 스킨케어 간호사입니다. 피부를 분석하고 잘 맞는 제품을 찾아드릴게요.',
    },
    fr: {
      tagline: 'Votre sanctuaire de soins bio',
      enter_store: 'Entrer dans la boutique', quick_analysis: 'Analyse rapide de la peau', sign_in: 'Connexion',
      nav_shop: 'Boutique', nav_chat: 'Chat', nav_analyze: 'Analyser',
      qa_consult: 'Consultation', qa_scan: 'Scan de peau', qa_tips: 'Conseils soin', qa_shopall: 'Tout voir',
      shop_title: 'Nos produits', search_ph: 'Rechercher des produits…', tips_title: 'Conseils d\'experts',
      chat_title: 'Lily · Conseillère soins', chat_ph: 'Écrivez votre message…',
      analyzer_title: 'Analyse de peau par IA', upload_title: 'Importer votre photo', upload_text: 'Visage, mains, bras, jambes — toutes les zones !',
      add_cart: 'Ajouter au panier', checkout: 'Paiement', place_order: 'Commander',
      looks_accurate: '✓ C\'est juste', adjust_scores: '✎ Ajuster les scores',
      hero_title: 'Connaissez votre peau. Prenez-en soin sereinement.',
      hero_sub: 'Analyse de peau par IA et soins bio personnalisés — guidés par Lily, votre conseillère virtuelle.',
      get_started: 'Commencer', how_it_works: 'Comment ça marche',
      benefit1_t: 'Analysez toute peau', benefit1_d: 'Photographiez visage, mains, jambes ou dos. L\'IA évalue votre peau et signale ce qui nécessite un médecin.',
      benefit2_t: 'Sélection personnalisée', benefit2_d: 'Des produits bio et vegan choisis pour vos besoins — avec la raison et le mode d\'emploi.',
      benefit3_t: 'Parlez à Lily', benefit3_d: 'Discutez à tout moment avec votre conseillère IA pour des conseils simples et utiles.',
      mission_t: 'Notre mission', mission_d: 'Rendre des soins fiables et personnalisés accessibles à tous — IA experte et produits certifiés propres.',
      vision_t: 'Notre vision', vision_d: 'Un monde où prendre soin de sa peau est simple, guidé par la science et respectueux de la planète.',
      meet_lily: 'Bonjour, je suis Lily 👋', lily_intro: 'Votre infirmière soin IA. Prête à analyser votre peau et trouver ce qui vous convient.',
    },
    id: {
      tagline: 'Surga Perawatan Kulit Organik Anda',
      enter_store: 'Masuk Toko', quick_analysis: 'Analisis Kulit Cepat', sign_in: 'Masuk',
      nav_shop: 'Belanja', nav_chat: 'Chat', nav_analyze: 'Analisis',
      qa_consult: 'Konsultasi', qa_scan: 'Pindai Kulit', qa_tips: 'Tips Perawatan', qa_shopall: 'Semua Produk',
      shop_title: 'Belanja Produk', search_ph: 'Cari produk…', tips_title: 'Tips Ahli',
      chat_title: 'Lily · Konsultan Kulit', chat_ph: 'Ketik pesan Anda…',
      analyzer_title: 'Analisis Kulit AI', upload_title: 'Unggah Foto Anda', upload_text: 'Wajah, tangan, lengan, kaki — bagian tubuh mana pun!',
      add_cart: 'Tambah ke Keranjang', checkout: 'Bayar', place_order: 'Pesan Sekarang',
      looks_accurate: '✓ Akurat', adjust_scores: '✎ Sesuaikan skor',
      hero_title: 'Kenali kulit Anda. Rawat dengan percaya diri.',
      hero_sub: 'Analisis kulit bertenaga AI dan perawatan organik yang dipersonalisasi — dipandu Lily, konsultan virtual Anda.',
      get_started: 'Mulai', how_it_works: 'Cara kerja',
      benefit1_t: 'Analisis kulit apa pun', benefit1_d: 'Foto wajah, tangan, kaki, atau punggung. AI menilai kulit Anda dan menandai yang perlu ke dokter.',
      benefit2_t: 'Pilihan personal', benefit2_d: 'Produk organik & vegan sesuai masalah Anda — dengan alasan dan cara pakainya.',
      benefit3_t: 'Bicara dengan Lily', benefit3_d: 'Mengobrol kapan saja dengan konsultan kulit AI untuk saran ramah dan praktis.',
      mission_t: 'Misi Kami', mission_d: 'Menjadikan perawatan kulit terpercaya dan personal dapat diakses semua orang — AI sadar dermatologi dan produk bersih bersertifikat.',
      vision_t: 'Visi Kami', vision_d: 'Dunia di mana merawat kulit itu sederhana, berbasis sains, dan ramah bumi.',
      meet_lily: 'Hai, saya Lily 👋', lily_intro: 'Perawat kulit AI Anda. Siap menganalisis kulit dan menemukan yang benar-benar cocok untuk Anda.',
    },
    ja: {
      tagline: 'あなたのオーガニックスキンケアの聖域',
      enter_store: 'ストアに入る', quick_analysis: 'クイック肌診断', sign_in: 'ログイン',
      nav_shop: 'ショップ', nav_chat: '相談', nav_analyze: '診断',
      qa_consult: '相談', qa_scan: '肌スキャン', qa_tips: 'スキンケアのコツ', qa_shopall: 'すべての商品',
      shop_title: '商品を見る', search_ph: '商品を検索…', tips_title: '専門家のヒント',
      chat_title: 'Lily · スキンケア相談員', chat_ph: 'メッセージを入力…',
      analyzer_title: 'AI 肌診断', upload_title: '写真をアップロード', upload_text: '顔、手、腕、脚 — どの部位でもOK！',
      add_cart: 'カートに追加', checkout: 'お会計', place_order: '注文する',
      looks_accurate: '✓ 正確です', adjust_scores: '✎ スコアを調整',
      hero_title: '肌を知り、自信を持ってケアを。',
      hero_sub: 'バーチャル相談員 Lily が案内する、AI 肌診断とパーソナライズされたオーガニックスキンケア。',
      get_started: '始める', how_it_works: '使い方',
      benefit1_t: 'あらゆる肌を診断', benefit1_d: '顔・手・脚・背中を撮影。AI が肌を評価し、受診が必要な点を知らせます。',
      benefit2_t: 'パーソナルな提案', benefit2_d: 'あなたの悩みに合うオーガニック・ヴィーガン製品を、理由と使い方とともにご提案。',
      benefit3_t: 'Lily と話す', benefit3_d: 'AI スキンケア相談員といつでも、親しみやすく実用的なアドバイスを。',
      mission_t: 'ミッション', mission_d: '皮膚科の知見を持つ AI とクリーンな認証製品で、信頼できるパーソナルなスキンケアをすべての人へ。',
      vision_t: 'ビジョン', vision_d: '肌のケアがシンプルで、科学に基づき、地球にやさしい世界を。',
      meet_lily: 'こんにちは、Lily です 👋', lily_intro: 'あなたの AI スキンケアナース。肌を診断し、本当に合うものを見つけます。',
    },
    ar: {
      tagline: 'ملاذك للعناية العضوية بالبشرة',
      enter_store: 'ادخل المتجر', quick_analysis: 'تحليل سريع للبشرة', sign_in: 'تسجيل الدخول',
      nav_shop: 'المتجر', nav_chat: 'محادثة', nav_analyze: 'تحليل',
      qa_consult: 'استشارة', qa_scan: 'فحص البشرة', qa_tips: 'نصائح العناية', qa_shopall: 'كل المنتجات',
      shop_title: 'تسوّق المنتجات', search_ph: 'ابحث عن المنتجات…', tips_title: 'نصائح الخبراء',
      chat_title: 'ليلي · مستشارة العناية', chat_ph: 'اكتب رسالتك…',
      analyzer_title: 'تحليل البشرة بالذكاء الاصطناعي', upload_title: 'ارفع صورتك', upload_text: 'الوجه، اليدان، الذراعان، الساقان — أي جزء من الجسم!',
      add_cart: 'أضف إلى السلة', checkout: 'الدفع', place_order: 'إتمام الطلب',
      looks_accurate: '✓ دقيق', adjust_scores: '✎ تعديل الدرجات',
      hero_title: 'اعرف بشرتك واعتنِ بها بثقة.',
      hero_sub: 'تحليل للبشرة بالذكاء الاصطناعي وعناية عضوية مخصّصة — بإرشاد من ليلي، مستشارتك الافتراضية.',
      get_started: 'ابدأ الآن', how_it_works: 'كيف يعمل',
      benefit1_t: 'حلّل أي بشرة', benefit1_d: 'صوّر وجهك أو يديك أو ساقيك أو ظهرك. يقيّم الذكاء الاصطناعي بشرتك وينبّهك لما يحتاج طبيبًا.',
      benefit2_t: 'اختيارات مخصّصة', benefit2_d: 'منتجات عضوية ونباتية مختارة لاحتياجاتك — مع سبب الترشيح وطريقة الاستخدام.',
      benefit3_t: 'تحدّث مع ليلي', benefit3_d: 'دردش في أي وقت مع مستشارة العناية الذكية للحصول على نصائح ودّية وعملية.',
      mission_t: 'مهمتنا', mission_d: 'جعل العناية الموثوقة والمخصّصة بالبشرة متاحة للجميع — ذكاء اصطناعي واعٍ بالأمراض الجلدية ومنتجات نظيفة معتمدة.',
      vision_t: 'رؤيتنا', vision_d: 'عالم تكون فيه العناية بالبشرة بسيطة وقائمة على العلم ولطيفة بكوكبنا.',
      meet_lily: 'مرحبًا، أنا ليلي 👋', lily_intro: 'ممرضتك للعناية بالبشرة بالذكاء الاصطناعي. جاهزة لتحليل بشرتك وإيجاد ما يناسبك فعلًا.',
    },
  };

  const RTL = ['ar'];
  const LANGS = [['en', 'English'], ['zh', '中文'], ['ko', '한국어'], ['fr', 'Français'], ['id', 'Bahasa'], ['ja', '日本語'], ['ar', 'العربية']];

  let lang = localStorage.getItem('pg_lang');
  if (!lang || !STRINGS[lang]) lang = (navigator.language || 'en').slice(0, 2);
  if (!STRINGS[lang]) lang = 'en';

  function t(key) {
    return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
  }

  function apply() {
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL.includes(lang) ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
  }

  function setLang(next) {
    if (!STRINGS[next]) return;
    lang = next;
    localStorage.setItem('pg_lang', next);
    apply();
    if (typeof window.onLangChange === 'function') window.onLangChange(next);
  }

  window.i18n = { t, setLang, apply, LANGS, get lang() { return lang; }, isRTL: () => RTL.includes(lang) };
  window.t = t;
})();
