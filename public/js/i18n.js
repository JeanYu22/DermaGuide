/* ===========================================================================
 * Lightweight i18n. English default; switcher covers Traditional Chinese,
 * Korean, French, Indonesian, Japanese, Arabic (RTL). AI-generated starting
 * translations — refine as needed. Missing keys fall back to English.
 *
 * HTML:  <span data-i18n="key"></span>   <input data-i18n-ph="key">
 * JS:    t('key')   tLabel('m_redness')  (metric/body-part/skin-type labels)
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
      hero_eyebrow: 'AI skincare concierge + commerce',
      trust_photo: '✓ Photo never stored', trust_checked: '✓ Reviewer-checked picks', trust_secure: '✓ Secure checkout',
      overall_score: 'Overall skin score', score_lbl: 'SCORE',
      glow_profile: 'Your Glow Profile', your_routine: 'Your recommended routine', routine_steps: 'Cleanse → Treat → Moisturize → SPF',
      add_routine: 'Add Full Routine to Cart', routine_added: 'Routine added to cart',
      checking_skin: 'Checking for visible skin…', analyzing_ai: 'Analyzing your skin with AI…', analyzing_short: 'Analyzing your skin… ✨', skin_detected: 'Skin detected',
      coach_hi: "Hi, I'm Lily 👋", coach_intro: "I'm your skincare guide. Let's start with a 20-second skin scan — then I'll build a routine made just for you.",
      coach_s1: 'Scan', coach_s2: 'Review', coach_s3: 'Shop routine', coach_start: 'Scan my skin', coach_skip: 'Explore the shop first',
      upload_selfie: 'Upload a selfie for cosmetic guidance', upload_help: 'Your photo is analyzed for cosmetic guidance and is never stored.',
      selfie_preview: 'Selfie preview', choose_photo: 'Choose Photo', drag_drop: 'Or drag and drop an image here.', start_snapshot: 'Start Private Skin Snapshot',
      tip_light: 'Use natural light and avoid heavy filters.', tip_center: 'Center the area and remove sunglasses or hats.',
      tip_nodiag: 'DermaGuide does not diagnose medical conditions.', tip_derived: 'Only derived cosmetic metrics are saved.',
      results_here: 'Your results appear here', results_hint: 'Upload a photo and Lily maps your skin metrics, then builds a routine — all on this page.',
      no_skin: 'No Skin Detected', not_human: 'Not Human Skin', analysis_failed: 'Analysis failed', upload_diff: 'Upload a different photo',
      get_started: 'Get Started', how_it_works: 'How it works',
      benefit1_t: 'Analyze any skin', benefit1_d: 'Snap a photo of your face, hands, legs or back. Our AI scores your skin and flags anything that needs a doctor.',
      benefit2_t: 'Personalised picks', benefit2_d: 'Get organic, vegan products chosen for your concerns — with the reason and how to use each one.',
      benefit3_t: 'Talk to Lily', benefit3_d: 'Chat anytime with your AI skincare consultant for friendly, practical advice.',
      mission_t: 'Our Mission', mission_d: 'Make trustworthy, personalised skincare accessible to everyone — combining dermatology-aware AI with clean, certified products.',
      vision_t: 'Our Vision', vision_d: 'A world where caring for your skin is simple, science-guided, and kind to the planet.',
      meet_lily: 'Hi, I\'m Lily 👋', lily_intro: 'Your AI skincare nurse. Ready to analyze your skin and find what truly works for you.',
      // Analyzer result UI
      pro_analysis: 'Professional Skin Analysis', top_concerns: 'Top Concerns', pro_rec: 'Professional Recommendation',
      accurate_q: 'Is this analysis accurate?', feedback_train: 'Your feedback continuously trains the analyzer.',
      rec_why: 'Why', rec_how: 'How to use', recommended_for: 'Recommended for you',
      new_analysis: 'New Analysis', chat_lily_btn: 'Chat with Lily', ml_active: 'ML Cross-Validation Active',
      see_pro: 'Please see a professional', save_scores: 'Save corrected scores', drag_scores: 'Drag to set the correct scores', cancel: 'Cancel',
      // Metric labels
      m_dryness: 'Dryness', m_dehydration: 'Dehydration', m_wrinkles: 'Wrinkles', m_sagging: 'Sagging',
      m_sensitivity: 'Sensitivity', m_redness: 'Redness', m_blockedPores: 'Blocked Pores', m_enlargedPores: 'Enlarged Pores',
      m_acne: 'Acne', m_pigmentation: 'Pigmentation', m_crepiness: 'Crepiness', m_roughness: 'Roughness',
      m_irritation: 'Irritation', m_bumps: 'Keratosis / Bumps', m_sunDamage: 'Sun Damage', m_calluses: 'Calluses',
      m_cracking: 'Cracking / Fissures', m_nailHealth: 'Nail Health', m_blackheads: 'Blackheads', m_oiliness: 'Oiliness',
      m_folliculitis: 'Folliculitis', m_scarring: 'Scarring', m_texture: 'Texture',
      // Body parts + skin types
      bp_face: 'Face', bp_neck: 'Neck', bp_hand: 'Hand', bp_arm: 'Arm', bp_leg: 'Leg', bp_foot: 'Foot', bp_back: 'Back', bp_chest: 'Chest', bp_skin: 'Skin',
      st_dry: 'Dry', st_normal: 'Normal', st_oily: 'Oily', st_combination: 'Combination',
    },
    zh: {
      tagline: '你的有機護膚聖地',
      enter_store: '進入商店', quick_analysis: '快速膚質分析', sign_in: '登入',
      nav_shop: '商店', nav_chat: '諮詢', nav_analyze: '分析',
      qa_consult: '諮詢', qa_scan: '肌膚掃描', qa_tips: '護膚貼士', qa_shopall: '全部商品',
      shop_title: '選購產品', search_ph: '搜尋產品…', tips_title: '專家貼士',
      chat_title: 'Lily · 護膚顧問', chat_ph: '輸入您的訊息…',
      analyzer_title: 'AI 肌膚分析', upload_title: '上傳照片', upload_text: '面部、手、手臂、腿——任何部位！',
      add_cart: '加入購物車', checkout: '結帳', place_order: '提交訂單',
      looks_accurate: '✓ 準確', adjust_scores: '✎ 調整評分',
      hero_title: '了解你的肌膚，自信護理。',
      hero_sub: '由你的虛擬顧問 Lily 引導，提供 AI 肌膚分析與個人化有機護膚。',
      hero_eyebrow: 'AI 護膚顧問 + 商店',
      trust_photo: '✓ 相片絕不儲存', trust_checked: '✓ 經審核的推薦', trust_secure: '✓ 安全結帳',
      overall_score: '整體膚質評分', score_lbl: '評分',
      glow_profile: '你的光采檔案', your_routine: '為你推薦的護理程序', routine_steps: '清潔 → 精華 → 保濕 → 防曬',
      add_routine: '將整套程序加入購物車', routine_added: '護理程序已加入購物車',
      checking_skin: '正在檢查可見肌膚…', analyzing_ai: '正在以 AI 分析你的肌膚…', analyzing_short: '正在分析你的肌膚… ✨', skin_detected: '偵測到肌膚',
      coach_hi: '你好，我是 Lily 👋', coach_intro: '我是你的護膚嚮導。先做一次 20 秒的肌膚掃描 — 然後我會為你打造專屬護理程序。',
      coach_s1: '掃描', coach_s2: '檢視', coach_s3: '選購程序', coach_start: '掃描我的肌膚', coach_skip: '先逛逛商店',
      upload_selfie: '上傳自拍以取得護膚建議', upload_help: '你的相片僅用於護膚分析，絕不儲存。',
      selfie_preview: '自拍預覽', choose_photo: '選擇相片', drag_drop: '或將圖片拖放到此處。', start_snapshot: '開始私密肌膚掃描',
      tip_light: '使用自然光，避免濃重濾鏡。', tip_center: '將部位置中，並取下太陽眼鏡或帽子。',
      tip_nodiag: 'DermaGuide 不會診斷任何醫療狀況。', tip_derived: '僅儲存衍生的護膚指標。',
      results_here: '分析結果將顯示於此', results_hint: '上傳相片，Lily 會分析你的肌膚指標並建立護理程序 — 全部在此頁完成。',
      no_skin: '未偵測到肌膚', not_human: '並非人類肌膚', analysis_failed: '分析失敗', upload_diff: '上傳其他相片',
      get_started: '立即開始', how_it_works: '使用方法',
      benefit1_t: '分析任何肌膚', benefit1_d: '拍下面部、手、腿或背部，AI 為你的肌膚評分，並提示需要就醫的情況。',
      benefit2_t: '個人化推薦', benefit2_d: '為你的需求挑選有機、純素產品——並說明推薦理由與使用方法。',
      benefit3_t: '與 Lily 對話', benefit3_d: '隨時與 AI 護膚顧問交流，獲得親切實用的建議。',
      mission_t: '我們的使命', mission_d: '讓可信賴的個人化護膚惠及每個人——結合具皮膚科意識的 AI 與純淨認證產品。',
      vision_t: '我們的願景', vision_d: '讓護理肌膚變得簡單、有科學依據且對地球友善。',
      meet_lily: '你好，我是 Lily 👋', lily_intro: '你的 AI 護膚護理師，隨時為你分析肌膚，找到真正適合你的方案。',
      pro_analysis: '專業肌膚分析', top_concerns: '主要問題', pro_rec: '專業建議',
      accurate_q: '這份分析準確嗎？', feedback_train: '您的回饋會持續訓練分析器。',
      rec_why: '原因', rec_how: '使用方法', recommended_for: '為您推薦',
      new_analysis: '新的分析', chat_lily_btn: '與 Lily 對話', ml_active: 'ML 交叉驗證已啟用',
      see_pro: '請諮詢專業人士', save_scores: '儲存修正後的評分', drag_scores: '拖動以設定正確評分', cancel: '取消',
      m_dryness: '乾燥', m_dehydration: '缺水', m_wrinkles: '皺紋', m_sagging: '鬆弛',
      m_sensitivity: '敏感', m_redness: '泛紅', m_blockedPores: '阻塞毛孔', m_enlargedPores: '粗大毛孔',
      m_acne: '痘痘', m_pigmentation: '色素沉澱', m_crepiness: '細紋鬆薄', m_roughness: '粗糙',
      m_irritation: '刺激', m_bumps: '角化／顆粒', m_sunDamage: '曬傷', m_calluses: '厚繭',
      m_cracking: '龜裂', m_nailHealth: '指甲健康', m_blackheads: '黑頭', m_oiliness: '出油',
      m_folliculitis: '毛囊炎', m_scarring: '疤痕', m_texture: '膚質',
      bp_face: '臉部', bp_neck: '頸部', bp_hand: '手部', bp_arm: '手臂', bp_leg: '腿部', bp_foot: '足部', bp_back: '背部', bp_chest: '胸部', bp_skin: '肌膚',
      st_dry: '乾性', st_normal: '中性', st_oily: '油性', st_combination: '混合性',
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
      hero_eyebrow: 'AI 스킨케어 컨시어지 + 커머스',
      trust_photo: '✓ 사진은 저장되지 않음', trust_checked: '✓ 검증된 추천', trust_secure: '✓ 안전한 결제',
      get_started: '시작하기', how_it_works: '이용 방법',
      benefit1_t: '모든 피부 분석', benefit1_d: '얼굴, 손, 다리, 등을 촬영하면 AI가 피부를 평가하고 진료가 필요한 부분을 알려줍니다.',
      benefit2_t: '맞춤 추천', benefit2_d: '고민에 맞춘 유기농·비건 제품을 추천하고 이유와 사용법을 알려드립니다.',
      benefit3_t: 'Lily와 대화', benefit3_d: 'AI 스킨케어 상담사와 언제든 친근하고 실용적인 조언을 나누세요.',
      mission_t: '우리의 미션', mission_d: '피부과 지식을 갖춘 AI와 깨끗한 인증 제품으로 신뢰할 수 있는 맞춤 스킨케어를 모두에게.',
      vision_t: '우리의 비전', vision_d: '피부 관리가 간단하고 과학적이며 지구에 친절한 세상.',
      meet_lily: '안녕하세요, Lily예요 👋', lily_intro: '당신의 AI 스킨케어 간호사입니다. 피부를 분석하고 잘 맞는 제품을 찾아드릴게요.',
      pro_analysis: '전문 피부 분석', top_concerns: '주요 고민', pro_rec: '전문가 추천',
      accurate_q: '이 분석이 정확한가요?', feedback_train: '회원님의 피드백이 분석기를 계속 학습시킵니다.',
      rec_why: '이유', rec_how: '사용법', recommended_for: '추천 제품',
      new_analysis: '새 분석', chat_lily_btn: 'Lily와 대화', ml_active: 'ML 교차 검증 활성화',
      see_pro: '전문가와 상담하세요', save_scores: '수정한 점수 저장', drag_scores: '드래그하여 올바른 점수를 설정하세요', cancel: '취소',
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
      hero_eyebrow: 'Concierge skincare IA + boutique',
      trust_photo: '✓ Photo jamais conservée', trust_checked: '✓ Sélections vérifiées', trust_secure: '✓ Paiement sécurisé',
      get_started: 'Commencer', how_it_works: 'Comment ça marche',
      benefit1_t: 'Analysez toute peau', benefit1_d: 'Photographiez visage, mains, jambes ou dos. L\'IA évalue votre peau et signale ce qui nécessite un médecin.',
      benefit2_t: 'Sélection personnalisée', benefit2_d: 'Des produits bio et vegan choisis pour vos besoins — avec la raison et le mode d\'emploi.',
      benefit3_t: 'Parlez à Lily', benefit3_d: 'Discutez à tout moment avec votre conseillère IA pour des conseils simples et utiles.',
      mission_t: 'Notre mission', mission_d: 'Rendre des soins fiables et personnalisés accessibles à tous — IA experte et produits certifiés propres.',
      vision_t: 'Notre vision', vision_d: 'Un monde où prendre soin de sa peau est simple, guidé par la science et respectueux de la planète.',
      meet_lily: 'Bonjour, je suis Lily 👋', lily_intro: 'Votre infirmière soin IA. Prête à analyser votre peau et trouver ce qui vous convient.',
      pro_analysis: 'Analyse professionnelle de la peau', top_concerns: 'Préoccupations principales', pro_rec: 'Recommandation professionnelle',
      accurate_q: 'Cette analyse est-elle exacte ?', feedback_train: 'Vos retours entraînent en continu l\'analyseur.',
      rec_why: 'Pourquoi', rec_how: 'Mode d\'emploi', recommended_for: 'Recommandé pour vous',
      new_analysis: 'Nouvelle analyse', chat_lily_btn: 'Discuter avec Lily', ml_active: 'Validation croisée ML active',
      see_pro: 'Veuillez consulter un professionnel', save_scores: 'Enregistrer les scores corrigés', drag_scores: 'Faites glisser pour définir les bons scores', cancel: 'Annuler',
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
      hero_eyebrow: 'Konsierge skincare AI + toko',
      trust_photo: '✓ Foto tidak disimpan', trust_checked: '✓ Pilihan terverifikasi', trust_secure: '✓ Pembayaran aman',
      get_started: 'Mulai', how_it_works: 'Cara kerja',
      benefit1_t: 'Analisis kulit apa pun', benefit1_d: 'Foto wajah, tangan, kaki, atau punggung. AI menilai kulit Anda dan menandai yang perlu ke dokter.',
      benefit2_t: 'Pilihan personal', benefit2_d: 'Produk organik & vegan sesuai masalah Anda — dengan alasan dan cara pakainya.',
      benefit3_t: 'Bicara dengan Lily', benefit3_d: 'Mengobrol kapan saja dengan konsultan kulit AI untuk saran ramah dan praktis.',
      mission_t: 'Misi Kami', mission_d: 'Menjadikan perawatan kulit terpercaya dan personal dapat diakses semua orang — AI sadar dermatologi dan produk bersih bersertifikat.',
      vision_t: 'Visi Kami', vision_d: 'Dunia di mana merawat kulit itu sederhana, berbasis sains, dan ramah bumi.',
      meet_lily: 'Hai, saya Lily 👋', lily_intro: 'Perawat kulit AI Anda. Siap menganalisis kulit dan menemukan yang benar-benar cocok untuk Anda.',
      pro_analysis: 'Analisis Kulit Profesional', top_concerns: 'Masalah Utama', pro_rec: 'Rekomendasi Profesional',
      accurate_q: 'Apakah analisis ini akurat?', feedback_train: 'Masukan Anda terus melatih penganalisis.',
      rec_why: 'Alasan', rec_how: 'Cara pakai', recommended_for: 'Direkomendasikan untuk Anda',
      new_analysis: 'Analisis Baru', chat_lily_btn: 'Mengobrol dengan Lily', ml_active: 'Validasi Silang ML Aktif',
      see_pro: 'Silakan temui profesional', save_scores: 'Simpan skor yang dikoreksi', drag_scores: 'Geser untuk menetapkan skor yang benar', cancel: 'Batal',
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
      hero_eyebrow: 'AI スキンケアコンシェルジュ + ショップ',
      trust_photo: '✓ 写真は保存しません', trust_checked: '✓ 審査済みの提案', trust_secure: '✓ 安全な決済',
      get_started: '始める', how_it_works: '使い方',
      benefit1_t: 'あらゆる肌を診断', benefit1_d: '顔・手・脚・背中を撮影。AI が肌を評価し、受診が必要な点を知らせます。',
      benefit2_t: 'パーソナルな提案', benefit2_d: 'あなたの悩みに合うオーガニック・ヴィーガン製品を、理由と使い方とともにご提案。',
      benefit3_t: 'Lily と話す', benefit3_d: 'AI スキンケア相談員といつでも、親しみやすく実用的なアドバイスを。',
      mission_t: 'ミッション', mission_d: '皮膚科の知見を持つ AI とクリーンな認証製品で、信頼できるパーソナルなスキンケアをすべての人へ。',
      vision_t: 'ビジョン', vision_d: '肌のケアがシンプルで、科学に基づき、地球にやさしい世界を。',
      meet_lily: 'こんにちは、Lily です 👋', lily_intro: 'あなたの AI スキンケアナース。肌を診断し、本当に合うものを見つけます。',
      pro_analysis: 'プロの肌分析', top_concerns: '主な悩み', pro_rec: '専門家のおすすめ',
      accurate_q: 'この分析は正確ですか？', feedback_train: 'あなたのフィードバックが分析を継続的に改善します。',
      rec_why: '理由', rec_how: '使い方', recommended_for: 'あなたへのおすすめ',
      new_analysis: '新しい分析', chat_lily_btn: 'Lily と話す', ml_active: 'ML クロス検証 有効',
      see_pro: '専門家にご相談ください', save_scores: '修正したスコアを保存', drag_scores: 'ドラッグして正しいスコアを設定', cancel: 'キャンセル',
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
      hero_eyebrow: 'مستشار العناية بالبشرة بالذكاء الاصطناعي + متجر',
      trust_photo: '✓ لا يتم تخزين الصورة', trust_checked: '✓ توصيات مُراجَعة', trust_secure: '✓ دفع آمن',
      get_started: 'ابدأ الآن', how_it_works: 'كيف يعمل',
      benefit1_t: 'حلّل أي بشرة', benefit1_d: 'صوّر وجهك أو يديك أو ساقيك أو ظهرك. يقيّم الذكاء الاصطناعي بشرتك وينبّهك لما يحتاج طبيبًا.',
      benefit2_t: 'اختيارات مخصّصة', benefit2_d: 'منتجات عضوية ونباتية مختارة لاحتياجاتك — مع سبب الترشيح وطريقة الاستخدام.',
      benefit3_t: 'تحدّث مع ليلي', benefit3_d: 'دردش في أي وقت مع مستشارة العناية الذكية للحصول على نصائح ودّية وعملية.',
      mission_t: 'مهمتنا', mission_d: 'جعل العناية الموثوقة والمخصّصة بالبشرة متاحة للجميع — ذكاء اصطناعي واعٍ بالأمراض الجلدية ومنتجات نظيفة معتمدة.',
      vision_t: 'رؤيتنا', vision_d: 'عالم تكون فيه العناية بالبشرة بسيطة وقائمة على العلم ولطيفة بكوكبنا.',
      meet_lily: 'مرحبًا، أنا ليلي 👋', lily_intro: 'ممرضتك للعناية بالبشرة بالذكاء الاصطناعي. جاهزة لتحليل بشرتك وإيجاد ما يناسبك فعلًا.',
      pro_analysis: 'تحليل احترافي للبشرة', top_concerns: 'أبرز المشكلات', pro_rec: 'توصية احترافية',
      accurate_q: 'هل هذا التحليل دقيق؟', feedback_train: 'ملاحظاتك تدرّب المحلّل باستمرار.',
      rec_why: 'السبب', rec_how: 'طريقة الاستخدام', recommended_for: 'موصى به لك',
      new_analysis: 'تحليل جديد', chat_lily_btn: 'تحدّث مع ليلي', ml_active: 'التحقق المتقاطع بالذكاء الاصطناعي مفعّل',
      see_pro: 'يرجى استشارة مختص', save_scores: 'حفظ الدرجات المصحّحة', drag_scores: 'اسحب لتحديد الدرجات الصحيحة', cancel: 'إلغاء',
    },
  };

  const RTL = ['ar'];
  const LANGS = [['en', 'English'], ['zh', '繁體中文'], ['ko', '한국어'], ['fr', 'Français'], ['id', 'Bahasa'], ['ja', '日本語'], ['ar', 'العربية']];

  let lang = localStorage.getItem('pg_lang');
  if (!lang || !STRINGS[lang]) lang = (navigator.language || 'en').slice(0, 2);
  if (!STRINGS[lang]) lang = 'en';

  function t(key) {
    return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
  }
  // Label helper for metric / body-part / skin-type keys (falls back to English).
  function tLabel(key, fallback) {
    return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || fallback || key;
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

  window.i18n = { t, tLabel, setLang, apply, LANGS, get lang() { return lang; }, isRTL: () => RTL.includes(lang) };
  window.t = t;
  window.tLabel = tLabel;
})();
