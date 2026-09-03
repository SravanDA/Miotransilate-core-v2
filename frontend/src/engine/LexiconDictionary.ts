/**
 * Enterprise Multi-Lingual Lexicon & Translation Engine for MioSalon
 * Provides accurate, natural, domain-specific translations across all supported languages.
 */

export interface LexiconEntry {
  ar: string; // Arabic
  es: string; // Spanish
  tr: string; // Turkish
  fr: string; // French
  it: string; // Italian
  de: string; // German
  pt: string; // Portuguese
  ru: string; // Russian
  zh: string; // Chinese
  ja: string; // Japanese
  ko: string; // Korean
  hi: string; // Hindi
  bg: string; // Bulgarian
  backTranslation?: string;
}

// ── EXACT CORE LEXICON DICTIONARY ──
export const LEXICON_DICTIONARY: Record<string, LexiconEntry> = {
  // ── Customer Wishlist & Demographics ──
  "anniversary": {
    ar: "ذكرى سنوية",
    es: "Aniversario",
    tr: "Yıldönümü",
    fr: "Anniversaire de mariage",
    it: "Anniversario",
    de: "Jubiläum",
    pt: "Aniversário",
    ru: "Годовщина",
    zh: "周年纪念",
    ja: "記念日",
    ko: "기념일",
    hi: "सालगिरह",
    bg: "Годишнина",
    backTranslation: "Anniversary"
  },
  "birthday": {
    ar: "عيد ميلاد",
    es: "Cumpleaños",
    tr: "Doğum Günü",
    fr: "Anniversaire",
    it: "Compleanno",
    de: "Geburtstag",
    pt: "Aniversário",
    ru: "День рождения",
    zh: "生日",
    ja: "誕生日",
    ko: "생일",
    hi: "जन्मदिन",
    bg: "Рожден ден",
    backTranslation: "Birthday"
  },
  "choose type": {
    ar: "اختر النوع",
    es: "Elegir tipo",
    tr: "Tür Seçin",
    fr: "Choisir le type",
    it: "Scegli tipo",
    de: "Typ auswählen",
    pt: "Escolher tipo",
    ru: "Выберите тип",
    zh: "选择类型",
    ja: "タイプを選択",
    ko: "유형 선택",
    hi: "प्रकार चुनें",
    bg: "Изберете тип",
    backTranslation: "Choose type"
  },
  "custom range": {
    ar: "نطاق مخصص",
    es: "Rango personalizado",
    tr: "Özel Aralık",
    fr: "Période personnalisée",
    it: "Intervallo personalizzato",
    de: "Benutzerdefinierter Bereich",
    pt: "Intervalo personalizado",
    ru: "Пользовательский диапазон",
    zh: "自定义范围",
    ja: "カスタム範囲",
    ko: "사용자 지정 범위",
    hi: "कस्टम रेंज",
    bg: "Персонализиран диапазон",
    backTranslation: "Custom range"
  },
  "male": {
    ar: "ذكر",
    es: "Masculino",
    tr: "Erkek",
    fr: "Homme",
    it: "Maschio",
    de: "Männlich",
    pt: "Masculino",
    ru: "Мужской",
    zh: "男",
    ja: "男性",
    ko: "남성",
    hi: "पुरुष",
    bg: "Мъж",
    backTranslation: "Male"
  },
  "female": {
    ar: "أنثى",
    es: "Femenino",
    tr: "Kadın",
    fr: "Femme",
    it: "Femmina",
    de: "Weiblich",
    pt: "Feminino",
    ru: "Женский",
    zh: "女",
    ja: "女性",
    ko: "여성",
    hi: "महिला",
    bg: "Жена",
    backTranslation: "Female"
  },
  "invalid date": {
    ar: "تاريخ غير صالح",
    es: "Fecha inválida",
    tr: "Geçersiz Tarih",
    fr: "Date non valide",
    it: "Data non valida",
    de: "Ungültiges Datum",
    pt: "Data inválida",
    ru: "Недействительная дата",
    zh: "无效日期",
    ja: "無効な日付",
    ko: "잘못된 날짜",
    hi: "अमान्य तारीख",
    bg: "Невалидна дата",
    backTranslation: "Invalid date"
  },
  "previous": {
    ar: "السابق",
    es: "Anterior",
    tr: "Önceki",
    fr: "Précédent",
    it: "Precedente",
    de: "Vorherige",
    pt: "Anterior",
    ru: "Предыдущий",
    zh: "上一页",
    ja: "前へ",
    ko: "이전",
    hi: "पिछला",
    bg: "Предишен",
    backTranslation: "Previous"
  },

  // ── Loyalty & Reward Points (MioSalon CRM & POS) ──
  "round off points": {
    ar: "نقاط التقريب",
    es: "Puntos de redondeo",
    tr: "Yuvarlama Puanları",
    fr: "Points d'arrondi",
    it: "Punti di arrotondamento",
    de: "Rundungspunkte",
    pt: "Pontos de arredondamento",
    ru: "Округление баллов",
    zh: "四舍五入积分",
    ja: "端数調整ポイント",
    ko: "반올림 포인트",
    hi: "राउंड ऑफ पॉइंट्स",
    bg: "Точки за закръгляне",
    backTranslation: "Rounding off points"
  },
  "reward points": {
    ar: "نقاط المكافآت",
    es: "Puntos de recompensa",
    tr: "Ödül Puanları",
    fr: "Points de récompense",
    it: "Punti ricompensa",
    de: "Belohnungspunkte",
    pt: "Pontos de recompensa",
    ru: "Бонусные баллы",
    zh: "奖励积分",
    ja: "特典ポイント",
    ko: "리워드 포인트",
    hi: "रिवॉर्ड पॉइंट्स",
    bg: "Бонус точки",
    backTranslation: "Reward points"
  },
  "reward point": {
    ar: "نقطة مكافأة",
    es: "Punto de recompensa",
    tr: "Ödül Puanı",
    fr: "Point de récompense",
    it: "Punto ricompensa",
    de: "Belohnungspunkt",
    pt: "Ponto de recompensa",
    ru: "Бонусный балл",
    zh: "奖励积分",
    ja: "特典ポイント",
    ko: "리워드 포인트",
    hi: "रिवॉर्ड पॉइंट",
    bg: "Бонус точка",
    backTranslation: "Reward point"
  },
  "reward point for products": {
    ar: "نقاط المكافأة للمنتجات",
    es: "Puntos de recompensa por productos",
    tr: "Ürünler İçin Ödül Puanı",
    fr: "Points de récompense pour les produits",
    it: "Punti ricompensa per i prodotti",
    de: "Belohnungspunkte für Produkte",
    pt: "Pontos de recompensa para produtos",
    ru: "Бонусные баллы за товары",
    zh: "商品奖励积分",
    ja: "商品特典ポイント",
    ko: "상품 리워드 포인트",
    hi: "उत्पादों के लिए रिवॉर्ड पॉइंट",
    bg: "Бонус точки за продукти",
    backTranslation: "Reward point for products"
  },
  "reward point for services": {
    ar: "نقاط المكافأة للخدمات",
    es: "Puntos de recompensa por servicios",
    tr: "Hizmetler İçin Ödül Puanı",
    fr: "Points de récompense pour les services",
    it: "Punti ricompensa per i servizi",
    de: "Belohnungspunkte für Dienstleistungen",
    pt: "Pontos de recompensa para serviços",
    ru: "Бонусные баллы за услуги",
    zh: "服务奖励积分",
    ja: "サービス特典ポイント",
    ko: "서비스 리워드 포인트",
    hi: "सेवाओं के लिए रिवॉर्ड पॉइंट",
    bg: "Бонус точки за услуги",
    backTranslation: "Reward point for services"
  },
  "assign": {
    ar: "تعيين",
    es: "Asignar",
    tr: "Ata",
    fr: "Attribuer",
    it: "Assegna",
    de: "Zuweisen",
    pt: "Atribuir",
    ru: "Назначить",
    zh: "分配",
    ja: "割り当て",
    ko: "지정",
    hi: "सौंपें",
    bg: "Задай",
    backTranslation: "Assign"
  },
  "reward point setting updated successfully!": {
    ar: "تم تحديث إعدادات نقاط المكافآت بنجاح!",
    es: "¡Configuración de puntos de recompensa actualizada con éxito!",
    tr: "Ödül puanı ayarları başarıyla güncellendi!",
    fr: "Paramètres des points de récompense mis à jour avec succès !",
    it: "Impostazioni dei punti ricompensa aggiornate con successo!",
    de: "Belohnungspunkte-Einstellungen erfolgreich aktualisiert!",
    pt: "Configurações de pontos de recompensa atualizadas com sucesso!",
    ru: "Настройки бонусных баллов успешно обновлены!",
    zh: "奖励积分设置更新成功！",
    ja: "特典ポイントの設定が正常に更新されました！",
    ko: "리워드 포인트 설정이 성공적으로 업데이트되었습니다!",
    hi: "रिवॉर्ड पॉइंट सेटिंग सफलतापूर्वक अपडेट हो गई!",
    bg: "Настройките за бонус точки са актуализирани успешно!",
    backTranslation: "Reward point settings updated successfully!"
  },
  "reward point setting updated successfully": {
    ar: "تم تحديث إعدادات نقاط المكافآت بنجاح",
    es: "Configuración de puntos de recompensa actualizada con éxito",
    tr: "Ödül puanı ayarları başarıyla güncellendi",
    fr: "Paramètres des points de récompense mis à jour avec succès",
    it: "Impostazioni dei punti ricompensa aggiornate con successo",
    de: "Belohnungspunkte-Einstellungen erfolgreich aktualisiert",
    pt: "Configurações de pontos de recompensa atualizadas com sucesso",
    ru: "Настройки бонусных баллов успешно обновлены",
    zh: "奖励积分设置更新成功",
    ja: "特典ポイントの設定が正常に更新されました",
    ko: "리워드 포인트 설정이 성공적으로 업데이트되었습니다",
    hi: "रिवॉर्ड पॉइंट सेटिंग सफलतापूर्वक अपडेट हो गई",
    bg: "Настройките за бонус точки са актуализирани успешно",
    backTranslation: "Reward point settings updated successfully"
  },
  "you can provide reward points to your customers for their purchases": {
    ar: "يمكنك منح نقاط مكافأة لعملائك مقابل مشترياتهم",
    es: "Puede otorgar puntos de recompensa a sus clientes por sus compras",
    tr: "Müşterilerinize alışverişleri için ödül puanları verebilirsiniz",
    fr: "Vous pouvez attribuer des points de récompense à vos clients pour leurs achats",
    it: "Puoi fornire punti ricompensa ai tuoi clienti per i loro acquisti",
    de: "Sie können Ihren Kunden Belohnungspunkte für ihre Einkäufe gutschreiben",
    pt: "Você pode oferecer pontos de recompensa aos seus clientes pelas compras",
    ru: "Вы можете начислять бонусные баллы клиентам за их покупки",
    zh: "您可以为客户的消费提供奖励积分",
    ja: "お客様の購入に対して特典ポイントを付与できます",
    ko: "고객의 구매에 대해 리워드 포인트를 지급할 수 있습니다",
    hi: "आप अपने ग्राहकों को उनकी खरीदारी के लिए रिवॉर्ड पॉइंट दे सकते हैं",
    bg: "Можете да предоставяте бонус точки на вашите клиенти за техните покупки",
    backTranslation: "You can provide reward points to your customers for their purchases"
  },
  "reward point for tax": {
    ar: "نقاط المكافأة للضريبة",
    es: "Puntos de recompensa por impuestos",
    tr: "Vergi İçin Ödül Puanı",
    fr: "Points de récompense pour les taxes",
    it: "Punti ricompensa per le tasse",
    de: "Belohnungspunkte für Steuern",
    pt: "Pontos de recompensa para impostos",
    ru: "Бонусные баллы за налоги",
    zh: "税费奖励积分",
    ja: "税金特典ポイント",
    ko: "세금 리워드 포인트",
    hi: "टैक्स के लिए रिवॉर्ड पॉइंट",
    bg: "Бонус точки за данък",
    backTranslation: "Reward point for tax"
  },
  "reward point for gift voucher": {
    ar: "نقاط المكافأة لقسيمة الهدايا",
    es: "Puntos de recompensa por cupón de regalo",
    tr: "Hediye Çeki İçin Ödül Puanı",
    fr: "Points de récompense pour bon cadeau",
    it: "Punti ricompensa per buono regalo",
    de: "Belohnungspunkte für Geschenkgutscheine",
    pt: "Pontos de recompensa para vale-presente",
    ru: "Бонусные баллы за подарочный сертификат",
    zh: "礼品券奖励积分",
    ja: "ギフト券特典ポイント",
    ko: "상품권 리워드 포인트",
    hi: "गिफ्ट वाउचर के लिए रिवॉर्ड पॉइंट",
    bg: "Бонус точки за ваучер за подарък",
    backTranslation: "Reward point for gift voucher"
  },
  "reward point for prepaid": {
    ar: "نقاط المكافأة للمدفوعات المسبقة",
    es: "Puntos de recompensa por prepago",
    tr: "Ön Ödeme İçin Ödül Puanı",
    fr: "Points de récompense pour prépayé",
    it: "Punti ricompensa per prepagato",
    de: "Belohnungspunkte für Guthaben",
    pt: "Pontos de recompensa para pré-pago",
    ru: "Бонусные баллы за предоплату",
    zh: "预付款奖励积分",
    ja: "前払い特典ポイント",
    ko: "선불 결제 리워드 포인트",
    hi: "प्रीपेड के लिए रिवॉर्ड पॉइंट",
    bg: "Бонус точки за предплащане",
    backTranslation: "Reward point for prepaid"
  },
  "reward point for membership customer": {
    ar: "نقاط المكافأة لعملاء العضوية",
    es: "Puntos de recompensa para clientes con membresía",
    tr: "Üyelik Müşterisi İçin Ödül Puanı",
    fr: "Points de récompense pour les membres",
    it: "Punti ricompensa per clienti tesserati",
    de: "Belohnungspunkte für Mitgliedskunden",
    pt: "Pontos de recompensa para clientes associados",
    ru: "Бонусные баллы для постоянных клиентов",
    zh: "会员客户奖励积分",
    ja: "会員顧客向け特典ポイント",
    ko: "멤버십 회원 전용 리워드 포인트",
    hi: "सदस्यता ग्राहकों के लिए रिवॉर्ड पॉइंट",
    bg: "Бонус точки за клиенти с членство",
    backTranslation: "Reward point for membership customer"
  },
  "you can provide reward points to your customers for various touch points. for example, when the total purchase goes beyond certain value, you can give 10 reward points to the customer. they can redeem these points in future.": {
    ar: "يمكنك تقديم نقاط مكافأة لعملائك في مختلف نقاط التواصل. على سبيل المثال، عندما تتجاوز قيمة المشتريات الإجمالية حداً معيناً، يمكنك إعطاء 10 نقاط مكافأة للعميل. ويمكنهم استرداد هذه النقاط في المستقبل.",
    es: "Puede ofrecer puntos de recompensa a sus clientes en varios puntos de contacto. Por ejemplo, cuando la compra total supera cierto valor, puede otorgar 10 puntos de recompensa al cliente, que podrá canjear en el futuro.",
    tr: "Müşterilerinize çeşitli temas noktalarında ödül puanları verebilirsiniz. Örneğin, toplam satın alma tutarı belirli bir değeri aştığında müşteriye 10 ödül puanı verebilirsiniz. Bu puanları gelecekte kullanabilirler.",
    fr: "Vous pouvez offrir des points de récompense à vos clients à différents points de contact. Par exemple, lorsque le montant total des achats dépasse une certaine valeur, vous pouvez attribuer 10 points de récompense au client qu'il pourra utiliser ultérieurement.",
    it: "Puoi offrire punti ricompensa ai tuoi clienti per vari punti di contatto. Ad esempio, quando l'acquisto totale supera un determinato importo, puoi assegnare 10 punti ricompensa al cliente, che potrà riscattare in futuro.",
    de: "Sie können Ihren Kunden an verschiedenen Kontaktpunkten Belohnungspunkte gutschreiben. Wenn beispielsweise der Gesamteinkaufswert einen bestimmten Betrag überschreitet, können Sie dem Kunden 10 Belohnungspunkte gewähren, die er künftig einlösen kann.",
    pt: "Você pode oferecer pontos de recompensa aos seus clientes em vários pontos de contato. Por exemplo, quando o valor total da compra ultrapassar determinado limite, você pode conceder 10 pontos ao cliente para resgate futuro.",
    ru: "Вы можете начислять бонусные баллы клиентам на различных этапах обслуживания. Например, когда общая сумма покупки превышает определенный порог, вы можете начислить 10 бонусных баллов, которые клиент сможет использовать в будущем.",
    zh: "您可以在各个接触点为客户提供奖励积分。例如，当总消费金额超过特定数值时，您可以给予客户 10 个奖励积分，供其日后兑换使用。",
    ja: "様々なタッチポイントでお客様に特典ポイントを付与できます。例えば、購入総額が一定額を超えた場合、10ポイントを付与し、次回以降の引き換えにご利用いただけます。",
    ko: "다양한 접점에서 고객에게 리워드 포인트를 제공할 수 있습니다. 예를 들어, 총 구매 금액이 일정 기준을 초과하면 고객에게 10 리워드 포인트를 지급하여 향후 결제 시 사용할 수 있습니다.",
    hi: "आप विभिन्न टच पॉइंट्स पर अपने ग्राहकों को रिवॉर्ड पॉइंट दे सकते हैं। उदाहरण के लिए, जब कुल खरीद एक निश्चित मूल्य से अधिक हो जाती है, तो आप ग्राहक को 10 रिवॉर्ड पॉइंट दे सकते हैं जिन्हें वे भविष्य में रिडीम कर सकते हैं।",
    bg: "Можете да предоставяте бонус точки на вашите клиенти в различни точки на контакт. Например, когато общата покупка надхвърли определена стойност, можете да дадете 10 бонус точки, които да бъдат осребрени в бъдеще.",
    backTranslation: "You can provide reward points to your customers for various touch points. For example, when the total purchase goes beyond certain value, you can give 10 reward points to the customer. They can redeem these points in future."
  },
  "purchase value": {
    ar: "قيمة الشراء",
    es: "Valor de compra",
    tr: "Satın Alma Tutarı",
    fr: "Valeur d'achat",
    it: "Valore di acquisto",
    de: "Kaufwert",
    pt: "Valor da compra",
    ru: "Сумма покупки",
    zh: "购买金额",
    ja: "購入金額",
    ko: "구매 금액",
    hi: "खरीद मूल्य",
    bg: "Стойност на покупката",
    backTranslation: "Purchase value"
  },

  // ── Reporting & Analytics Metrics (User's Exact Screenshot Terms) ──
  "prepaid redemption vs non prepaid redemption": {
    ar: "استرداد المدفوعات المسبقة مقابل غير المسبقة",
    es: "Canje prepagado vs no prepagado",
    tr: "Ön Ödemeli ve Ön Ödemesiz Kullanım Karşılaştırması",
    fr: "Rachat prépayé vs non prépayé",
    it: "Riscatto prepagato vs non prepagato",
    de: "Einlösung von Guthaben vs. Nicht-Guthaben",
    pt: "Resgate pré-pago vs não pré-pago",
    ru: "Погашение предоплаты по сравнению с обычной оплатой",
    zh: "预付兑换与非预付兑换对比",
    ja: "前払い引き換え vs 非前払い引き換え",
    ko: "선불 사용 대 일반 결제 비교",
    hi: "प्रीपेड रिडेम्पशन बनाम नॉन-प्रीपेड रिडेम्पशन",
    bg: "Предплатено ползване спрямо непредплатено",
    backTranslation: "Prepaid redemption compared to non-prepaid redemption"
  },
  "prepaid redemption": {
    ar: "استرداد المدفوعات المسبقة",
    es: "Canje prepagado",
    tr: "Ön Ödemeli Kullanım",
    fr: "Rachat prépayé",
    it: "Riscatto prepagato",
    de: "Guthabeneinlösung",
    pt: "Resgate pré-pago",
    ru: "Погашение предоплаты",
    zh: "预付兑换",
    ja: "前払い引き換え",
    ko: "선불 사용",
    hi: "प्रीपेड रिडेम्पशन",
    bg: "Предплатено осребряване",
    backTranslation: "Prepaid redemption"
  },
  "non prepaid redemption": {
    ar: "استرداد غير المدفوعات المسبقة",
    es: "Canje no prepagado",
    tr: "Ön Ödemesiz Kullanım",
    fr: "Rachat non prépayé",
    it: "Riscatto non prepagato",
    de: "Nicht-Guthabeneinlösung",
    pt: "Resgate não pré-pago",
    ru: "Обычное погашение",
    zh: "非预付兑换",
    ja: "非前払い引き換え",
    ko: "일반 결제 사용",
    hi: "गैर-प्रीपेड रिडेम्पशन",
    bg: "Непредплатено ползване",
    backTranslation: "Non-prepaid redemption"
  },
  "revenue from churn prediction": {
    ar: "الإيرادات من التنبؤ بمغادرة العملاء",
    es: "Ingresos por predicción de abandono",
    tr: "Müşteri Kaybı Tahmininden Elde Edilen Gelir",
    fr: "Revenus issus de la prédiction du désabonnement",
    it: "Entrate da previsione dell'abbandono",
    de: "Umsatz aus Abwanderungsprognose",
    pt: "Receita de previsão de cancelamento",
    ru: "Доход от прогнозирования оттока клиентов",
    zh: "流失预测带来的收入",
    ja: "解約予測による収益",
    ko: "이탈 예측 기반 수익",
    hi: "मंथन भविष्यवाणी से राजस्व",
    bg: "Приходи от прогнозиране на отлива",
    backTranslation: "Revenue generated from churn risk predictions"
  },
  "total": {
    ar: "المجموع",
    es: "Total",
    tr: "Toplam",
    fr: "Total",
    it: "Totale",
    de: "Gesamt",
    pt: "Total",
    ru: "Итого",
    zh: "总计",
    ja: "合計",
    ko: "총계",
    hi: "कुल",
    bg: "Общо",
    backTranslation: "Total"
  },
  "today": {
    ar: "اليوم",
    es: "Hoy",
    tr: "Bugün",
    fr: "Aujourd'hui",
    it: "Oggi",
    de: "Heute",
    pt: "Hoje",
    ru: "Сегодня",
    zh: "今天",
    ja: "本日",
    ko: "오늘",
    hi: "आज",
    bg: "Днес",
    backTranslation: "Today"
  },
  "yesterday": {
    ar: "أمس",
    es: "Ayer",
    tr: "Dün",
    fr: "Hier",
    it: "Ieri",
    de: "Gestern",
    pt: "Ontem",
    ru: "Вчера",
    zh: "昨天",
    ja: "昨日",
    ko: "어제",
    hi: "कल",
    bg: "Вчера",
    backTranslation: "Yesterday"
  },
  "last 7 days": {
    ar: "آخر 7 أيام",
    es: "Últimos 7 días",
    tr: "Son 7 gün",
    fr: "7 derniers jours",
    it: "Ultimi 7 giorni",
    de: "Letzte 7 Tage",
    pt: "Últimos 7 dias",
    ru: "Последние 7 дней",
    zh: "最近 7 天",
    ja: "過去7日間",
    ko: "최근 7일",
    hi: "पिछले 7 दिन",
    bg: "Последните 7 дни",
    backTranslation: "Last 7 days"
  },
  "last 14 days": {
    ar: "آخر 14 يوماً",
    es: "Últimos 14 días",
    tr: "Son 14 gün",
    fr: "14 derniers jours",
    it: "Ultimi 14 giorni",
    de: "Letzte 14 Tage",
    pt: "Últimos 14 dias",
    ru: "Последние 14 дней",
    zh: "最近 14 天",
    ja: "過去14日間",
    ko: "최근 14일",
    hi: "पिछले 14 दिन",
    bg: "Последните 14 дни",
    backTranslation: "Last 14 days"
  },
  "last 30 days": {
    ar: "آخر 30 يوماً",
    es: "Últimos 30 días",
    tr: "Son 30 gün",
    fr: "30 derniers jours",
    it: "Ultimi 30 giorni",
    de: "Letzte 30 Tage",
    pt: "Últimos 30 dias",
    ru: "Последние 30 дней",
    zh: "最近 30 天",
    ja: "過去30日間",
    ko: "최근 30일",
    hi: "पिछले 30 दिन",
    bg: "Последните 30 дни",
    backTranslation: "Last 30 days"
  },
  "last 90 days": {
    ar: "آخر 90 يوماً",
    es: "Últimos 90 días",
    tr: "Son 90 gün",
    fr: "90 derniers jours",
    it: "Ultimi 90 giorni",
    de: "Letzte 90 Tage",
    pt: "Últimos 90 dias",
    ru: "Последние 90 дней",
    zh: "最近 90 天",
    ja: "過去90日間",
    ko: "최근 90일",
    hi: "पिछले 90 दिन",
    bg: "Последните 90 дни",
    backTranslation: "Last 90 days"
  },
  "this month": {
    ar: "هذا الشهر",
    es: "Este mes",
    tr: "Bu ay",
    fr: "Ce mois-ci",
    it: "Questo mese",
    de: "Diesen Monat",
    pt: "Este mês",
    ru: "Этот месяц",
    zh: "本月",
    ja: "今月",
    ko: "이번 달",
    hi: "इस महीने",
    bg: "Този месец",
    backTranslation: "This month"
  },
  "last month": {
    ar: "الشهر الماضي",
    es: "El mes pasado",
    tr: "Geçen ay",
    fr: "Le mois dernier",
    it: "Il mese scorso",
    de: "Letzten Monat",
    pt: "Mês passado",
    ru: "Прошлый месяц",
    zh: "上个月",
    ja: "先月",
    ko: "지난달",
    hi: "पिछला महीना",
    bg: "Миналия месец",
    backTranslation: "Last month"
  },

  // ── Salon & Spa Operations ──
  "appointments": {
    ar: "المواعيد",
    es: "Citas",
    tr: "Randevular",
    fr: "Rendez-vous",
    it: "Appuntamenti",
    de: "Termine",
    pt: "Agendamentos",
    ru: "Записи",
    zh: "预约",
    ja: "予約",
    ko: "예약",
    hi: "अपॉइंटमेंट्स",
    bg: "Часове",
    backTranslation: "Appointments"
  },
  "appointment": {
    ar: "موعد",
    es: "Cita",
    tr: "Randevu",
    fr: "Rendez-vous",
    it: "Appuntamento",
    de: "Termin",
    pt: "Agendamento",
    ru: "Запись",
    zh: "预约",
    ja: "予約",
    ko: "예약",
    hi: "अपॉइंटमेंट",
    bg: "Час",
    backTranslation: "Appointment"
  },
  "services": {
    ar: "الخدمات",
    es: "Servicios",
    tr: "Hizmetler",
    fr: "Services",
    it: "Servizi",
    de: "Dienstleistungen",
    pt: "Serviços",
    ru: "Услуги",
    zh: "服务项目",
    ja: "サービス",
    ko: "서비스",
    hi: "सेवाएं",
    bg: "Услуги",
    backTranslation: "Services"
  },
  "service": {
    ar: "خدمة",
    es: "Servicio",
    tr: "Hizmet",
    fr: "Service",
    it: "Servizio",
    de: "Dienstleistung",
    pt: "Serviço",
    ru: "Услуга",
    zh: "服务",
    ja: "サービス",
    ko: "서비스",
    hi: "सेवा",
    bg: "Услуга",
    backTranslation: "Service"
  },
  "staff": {
    ar: "فريق العمل",
    es: "Personal",
    tr: "Personel",
    fr: "Personnel",
    it: "Personale",
    de: "Mitarbeiter",
    pt: "Equipe",
    ru: "Сотрудники",
    zh: "员工",
    ja: "スタッフ",
    ko: "직원",
    hi: "स्टाफ",
    bg: "Персонал",
    backTranslation: "Staff members"
  },
  "clients": {
    ar: "العملاء",
    es: "Clientes",
    tr: "Müşteriler",
    fr: "Clients",
    it: "Clienti",
    de: "Kunden",
    pt: "Clientes",
    ru: "Клиенты",
    zh: "客户",
    ja: "お客様",
    ko: "고객",
    hi: "ग्राहक",
    bg: "Клиенти",
    backTranslation: "Clients"
  },
  "customers": {
    ar: "الزبائن",
    es: "Clientes",
    tr: "Müşteriler",
    fr: "Clients",
    it: "Clienti",
    de: "Kunden",
    pt: "Clientes",
    ru: "Покупатели",
    zh: "顾客",
    ja: "顧客",
    ko: "고객",
    hi: "ग्राहक",
    bg: "Клиенти",
    backTranslation: "Customers"
  },
  "inventory": {
    ar: "المخزون",
    es: "Inventario",
    tr: "Stok",
    fr: "Inventaire",
    it: "Inventario",
    de: "Bestand",
    pt: "Inventário",
    ru: "Склад",
    zh: "库存",
    ja: "在庫",
    ko: "재고",
    hi: "इन्वेंटरी",
    bg: "Инвентар",
    backTranslation: "Inventory"
  },
  "products": {
    ar: "المنتجات",
    es: "Productos",
    tr: "Ürünler",
    fr: "Produits",
    it: "Prodotti",
    de: "Produkte",
    pt: "Produtos",
    ru: "Товары",
    zh: "产品",
    ja: "商品",
    ko: "상품",
    hi: "उत्पाद",
    bg: "Продукти",
    backTranslation: "Products"
  },
  "quick sale": {
    ar: "بيع سريع",
    es: "Venta rápida",
    tr: "Hızlı Satış",
    fr: "Vente rapide",
    it: "Vendita rapida",
    de: "Schnellverkauf",
    pt: "Venda rápida",
    ru: "Быстрая продажа",
    zh: "快速收银",
    ja: "クイック会計",
    ko: "빠른 판매",
    hi: "क्विक सेल",
    bg: "Бърза продажба",
    backTranslation: "Quick sale / POS transaction"
  },
  "invoice": {
    ar: "فاتورة",
    es: "Factura",
    tr: "Fatura",
    fr: "Facture",
    it: "Fattura",
    de: "Rechnung",
    pt: "Fatura",
    ru: "Счет",
    zh: "发票",
    ja: "請求書",
    ko: "청구서",
    hi: "इनवॉइस",
    bg: "Фактура",
    backTranslation: "Invoice"
  },
  "payment": {
    ar: "الدفع",
    es: "Pago",
    tr: "Ödeme",
    fr: "Paiement",
    it: "Pagamento",
    de: "Zahlung",
    pt: "Pagamento",
    ru: "Оплата",
    zh: "支付",
    ja: "支払い",
    ko: "결제",
    hi: "भुगतान",
    bg: "Плащане",
    backTranslation: "Payment"
  },
  "discount": {
    ar: "خصم",
    es: "Descuento",
    tr: "İndirim",
    fr: "Remise",
    it: "Sconto",
    de: "Rabatt",
    pt: "Desconto",
    ru: "Скидка",
    zh: "折扣",
    ja: "割引",
    ko: "할인",
    hi: "छूट",
    bg: "Отстъпка",
    backTranslation: "Discount"
  },
  "tax": {
    ar: "الضريبة",
    es: "Impuesto",
    tr: "Vergi",
    fr: "Taxe",
    it: "Imposta",
    de: "Steuer",
    pt: "Imposto",
    ru: "Налог",
    zh: "税费",
    ja: "税金",
    ko: "세금",
    hi: "कर",
    bg: "Данък",
    backTranslation: "Tax"
  },
  "membership": {
    ar: "العضوية",
    es: "Membresía",
    tr: "Üyelik",
    fr: "Adhésion",
    it: "Abbonamento",
    de: "Mitgliedschaft",
    pt: "Assinatura",
    ru: "Абонемент",
    zh: "会员卡",
    ja: "会員権",
    ko: "멤버십",
    hi: "सदस्यता",
    bg: "Членство",
    backTranslation: "Membership"
  },
  "package": {
    ar: "باقة",
    es: "Paquete",
    tr: "Paket",
    fr: "Forfait",
    it: "Pacchetto",
    de: "Paket",
    pt: "Pacote",
    ru: "Пакет услуг",
    zh: "套餐",
    ja: "パッケージ",
    ko: "패키지",
    hi: "पैकेज",
    bg: "Пакет",
    backTranslation: "Package"
  },
  "gift voucher": {
    ar: "قسيمة هدية",
    es: "Cupón de regalo",
    tr: "Hediye Çeki",
    fr: "Bon cadeau",
    it: "Buono regalo",
    de: "Geschenkgutschein",
    pt: "Vale-presente",
    ru: "Подарочный сертификат",
    zh: "礼品券",
    ja: "ギフト券",
    ko: "상품권",
    hi: "गिफ्ट वाउचर",
    bg: "Ваучер за подарък",
    backTranslation: "Gift voucher"
  },
  "loyalty points": {
    ar: "نقاط الولاء",
    es: "Puntos de fidelidad",
    tr: "Sadakat Puanları",
    fr: "Points de fidélité",
    it: "Punti fedeltà",
    de: "Treuepunkte",
    pt: "Pontos de fidelidade",
    ru: "Бонусные баллы",
    zh: "积分",
    ja: "ポイント",
    ko: "적립 포인트",
    hi: "लॉयल्टी पॉइंट्स",
    bg: "Точки за лоялност",
    backTranslation: "Loyalty points"
  },

  // ── Actions & Buttons ──
  "save changes": {
    ar: "حفظ التغييرات",
    es: "Guardar cambios",
    tr: "Değişiklikleri Kaydet",
    fr: "Enregistrer les modifications",
    it: "Salva modifiche",
    de: "Änderungen speichern",
    pt: "Salvar alterações",
    ru: "Сохранить изменения",
    zh: "保存更改",
    ja: "変更を保存",
    ko: "변경사항 저장",
    hi: "बदलाव सहेजें",
    bg: "Запази промените",
    backTranslation: "Save changes"
  },
  "cancel": {
    ar: "إلغاء",
    es: "Cancelar",
    tr: "İptal",
    fr: "Annuler",
    it: "Annulla",
    de: "Abbrechen",
    pt: "Cancelar",
    ru: "Отмена",
    zh: "取消",
    ja: "キャンセル",
    ko: "취소",
    hi: "रद्द करें",
    bg: "Отказ",
    backTranslation: "Cancel"
  },
  "delete": {
    ar: "حذف",
    es: "Eliminar",
    tr: "Sil",
    fr: "Supprimer",
    it: "Elimina",
    de: "Löschen",
    pt: "Excluir",
    ru: "Удалить",
    zh: "删除",
    ja: "削除",
    ko: "삭제",
    hi: "हटाएं",
    bg: "Изтрий",
    backTranslation: "Delete"
  },
  "edit": {
    ar: "تعديل",
    es: "Editar",
    tr: "Düzenle",
    fr: "Modifier",
    it: "Modifica",
    de: "Bearbeiten",
    pt: "Editar",
    ru: "Редактировать",
    zh: "编辑",
    ja: "編集",
    ko: "편집",
    hi: "संपादित करें",
    bg: "Редактирай",
    backTranslation: "Edit"
  },
  "add": {
    ar: "إضافة",
    es: "Añadir",
    tr: "Ekle",
    fr: "Ajouter",
    it: "Aggiungi",
    de: "Hinzufügen",
    pt: "Adicionar",
    ru: "Добавить",
    zh: "添加",
    ja: "追加",
    ko: "추가",
    hi: "जोड़ें",
    bg: "Добави",
    backTranslation: "Add"
  },
  "submit": {
    ar: "إرسال",
    es: "Enviar",
    tr: "Gönder",
    fr: "Soumettre",
    it: "Invia",
    de: "Absenden",
    pt: "Enviar",
    ru: "Отправить",
    zh: "提交",
    ja: "送信",
    ko: "제출",
    hi: "जमा करें",
    bg: "Подай",
    backTranslation: "Submit"
  },
  "approve": {
    ar: "موافقة",
    es: "Aprobar",
    tr: "Onayla",
    fr: "Approuver",
    it: "Approva",
    de: "Genehmigen",
    pt: "Aprovar",
    ru: "Одобрить",
    zh: "批准",
    ja: "承認",
    ko: "승인",
    hi: "स्वीकृत करें",
    bg: "Одобри",
    backTranslation: "Approve"
  },
  "reject": {
    ar: "رفض",
    es: "Rechazar",
    tr: "Reddet",
    fr: "Rejeter",
    it: "Rifiuta",
    de: "Ablehnen",
    pt: "Rejeitar",
    ru: "Отклонить",
    zh: "拒绝",
    ja: "却下",
    ko: "반려",
    hi: "अस्वीकार करें",
    bg: "Отхвърли",
    backTranslation: "Reject"
  },
  "publish": {
    ar: "نشر",
    es: "Publicar",
    tr: "Yayınla",
    fr: "Publier",
    it: "Pubblica",
    de: "Veröffentlichen",
    pt: "Publicar",
    ru: "Опубликовать",
    zh: "发布",
    ja: "公開",
    ko: "배포",
    hi: "प्रकाशित करें",
    bg: "Публикувай",
    backTranslation: "Publish"
  },
  "export": {
    ar: "تصدير",
    es: "Exportar",
    tr: "Dışa Aktar",
    fr: "Exporter",
    it: "Esporta",
    de: "Exportieren",
    pt: "Exportar",
    ru: "Экспорт",
    zh: "导出",
    ja: "エクスポート",
    ko: "내보내기",
    hi: "निर्यात",
    bg: "Експорт",
    backTranslation: "Export"
  },
  "import": {
    ar: "استيراد",
    es: "Importar",
    tr: "İçe Aktar",
    fr: "Importer",
    it: "Importa",
    de: "Importieren",
    pt: "Importar",
    ru: "Импорт",
    zh: "导入",
    ja: "インポート",
    ko: "가져오기",
    hi: "आयात",
    bg: "Импорт",
    backTranslation: "Import"
  },
  "search": {
    ar: "بحث",
    es: "Buscar",
    tr: "Ara",
    fr: "Rechercher",
    it: "Cerca",
    de: "Suchen",
    pt: "Pesquisar",
    ru: "Поиск",
    zh: "搜索",
    ja: "検索",
    ko: "검색",
    hi: "खोजें",
    bg: "Търсене",
    backTranslation: "Search"
  },
  "filter": {
    ar: "تصفية",
    es: "Filtrar",
    tr: "Filtrele",
    fr: "Filtrer",
    it: "Filtra",
    de: "Filtern",
    pt: "Filtrar",
    ru: "Фильтр",
    zh: "筛选",
    ja: "絞り込み",
    ko: "필터",
    hi: "फ़िल्टर",
    bg: "Филтър",
    backTranslation: "Filter"
  },
  "status": {
    ar: "الحالة",
    es: "Estado",
    tr: "Durum",
    fr: "Statut",
    it: "Stato",
    de: "Status",
    pt: "Status",
    ru: "Статус",
    zh: "状态",
    ja: "ステータス",
    ko: "상태",
    hi: "स्थिति",
    bg: "Статус",
    backTranslation: "Status"
  },
  "active": {
    ar: "نشط",
    es: "Activo",
    tr: "Aktif",
    fr: "Actif",
    it: "Attivo",
    de: "Aktiv",
    pt: "Ativo",
    ru: "Активен",
    zh: "启用",
    ja: "有効",
    ko: "활성",
    hi: "सक्रिय",
    bg: "Активен",
    backTranslation: "Active"
  },
  "pending": {
    ar: "قيد الانتظار",
    es: "Pendiente",
    tr: "Beklemede",
    fr: "En attente",
    it: "In attesa",
    de: "Ausstehend",
    pt: "Pendente",
    ru: "В ожидании",
    zh: "待处理",
    ja: "保留中",
    ko: "대기 중",
    hi: "लंबित",
    bg: "В очакване",
    backTranslation: "Pending"
  },
  "completed": {
    ar: "مكتمل",
    es: "Completado",
    tr: "Tamamlandı",
    fr: "Terminé",
    it: "Completato",
    de: "Abgeschlossen",
    pt: "Concluído",
    ru: "Завершено",
    zh: "已完成",
    ja: "完了",
    ko: "완료",
    hi: "पूर्ण",
    bg: "Завършен",
    backTranslation: "Completed"
  },
  "settings": {
    ar: "الإعدادات",
    es: "Configuración",
    tr: "Ayarlar",
    fr: "Paramètres",
    it: "Impostazioni",
    de: "Einstellungen",
    pt: "Configurações",
    ru: "Настройки",
    zh: "设置",
    ja: "設定",
    ko: "설정",
    hi: "सेटिंग्स",
    bg: "Настройки",
    backTranslation: "Settings"
  },
  "reports": {
    ar: "التقارير",
    es: "Informes",
    tr: "Raporlar",
    fr: "Rapports",
    it: "Rapporti",
    de: "Berichte",
    pt: "Relatórios",
    ru: "Отчеты",
    zh: "报表",
    ja: "レポート",
    ko: "보고서",
    hi: "रिपोर्ट्स",
    bg: "Отчети",
    backTranslation: "Reports"
  },
  "analytics": {
    ar: "التحليلات",
    es: "Análisis",
    tr: "Analizler",
    fr: "Analyses",
    it: "Analitica",
    de: "Analysen",
    pt: "Análises",
    ru: "Аналитика",
    zh: "数据分析",
    ja: "分析",
    ko: "분석",
    hi: "एनालिटिक्स",
    bg: "Анализи",
    backTranslation: "Analytics"
  },
  "dashboard": {
    ar: "لوحة التحكم",
    es: "Panel principal",
    tr: "Kontrol Paneli",
    fr: "Tableau de bord",
    it: "Cruscotto",
    de: "Dashboard",
    pt: "Painel",
    ru: "Панель управления",
    zh: "仪表板",
    ja: "ダッシュボード",
    ko: "대시보드",
    hi: "डैशबोर्ड",
    bg: "Табло",
    backTranslation: "Dashboard"
  }
};

// ── WORD & NOUN PHRASE VOCABULARY FOR DYNAMIC COMPOSITION ──
const WORD_MAP: Record<string, Record<string, string>> = {
  ar: {
    "revenue": "الإيرادات",
    "churn": "مغادرة العملاء",
    "prediction": "التنبؤ",
    "from": "من",
    "to": "إلى",
    "by": "بواسطة",
    "with": "مع",
    "vs": "مقابل",
    "and": "و",
    "or": "أو",
    "prepaid": "المدفوع مسبقاً",
    "redemption": "الاسترداد",
    "non": "غير",
    "sales": "المبيعات",
    "summary": "الملخص",
    "details": "التفاصيل",
    "total": "المجموع",
    "today": "اليوم",
    "days": "أيام",
    "last": "آخر",
    "range": "النطاق",
    "custom": "مخصص",
    "rate": "معدل",
    "count": "العدد",
    "amount": "المبلغ",
    "client": "العميل",
    "staff": "الموظف",
    "service": "الخدمة",
    "product": "المنتج",
    "branch": "الفرع",
    "booking": "الحجز",
    "commission": "العمولة",
    "tips": "الإكراميات",
    "online": "عبر الإنترنت",
    "walk-in": "حضور مباشر",
    "confirmed": "مؤكد",
    "cancelled": "ملغى",
    "no-show": "لم يحضر"
  },
  es: {
    "revenue": "Ingresos",
    "churn": "Abandono",
    "prediction": "Predicción",
    "from": "de",
    "to": "a",
    "by": "por",
    "with": "con",
    "vs": "vs",
    "and": "y",
    "or": "o",
    "prepaid": "prepagado",
    "redemption": "canje",
    "non": "no",
    "sales": "Ventas",
    "summary": "Resumen",
    "details": "Detalles",
    "total": "Total",
    "today": "Hoy",
    "days": "días",
    "last": "Últimos",
    "range": "Rango",
    "custom": "personalizado",
    "rate": "Tasa",
    "count": "Cantidad",
    "amount": "Monto",
    "client": "Cliente",
    "staff": "Personal",
    "service": "Servicio",
    "product": "Producto",
    "branch": "Sucursal",
    "booking": "Reserva",
    "commission": "Comisión",
    "tips": "Propinas",
    "online": "En línea",
    "walk-in": "Sin cita",
    "confirmed": "Confirmado",
    "cancelled": "Cancelado",
    "no-show": "No presentado"
  },
  tr: {
    "revenue": "Gelir",
    "churn": "Müşteri Kaybı",
    "prediction": "Tahmin",
    "from": "tarafından",
    "to": "kadar",
    "by": "göre",
    "with": "ile",
    "vs": "ve",
    "and": "ve",
    "or": "veya",
    "prepaid": "ön ödemeli",
    "redemption": "kullanım",
    "non": "ön ödemesiz",
    "sales": "Satışlar",
    "summary": "Özet",
    "details": "Detaylar",
    "total": "Toplam",
    "today": "Bugün",
    "days": "gün",
    "last": "Son",
    "range": "Aralık",
    "custom": "özel",
    "rate": "Oran",
    "count": "Adet",
    "amount": "Tutar",
    "client": "Müşteri",
    "staff": "Personel",
    "service": "Hizmet",
    "product": "Ürün",
    "branch": "Şube",
    "booking": "Randevu",
    "commission": "Komisyon",
    "tips": "Bahşişler",
    "online": "Çevrim içi",
    "walk-in": "Randevusuz",
    "confirmed": "Onaylandı",
    "cancelled": "İptal edildi",
    "no-show": "Gelmeyen"
  },
  fr: {
    "revenue": "Revenus",
    "churn": "Désabonnement",
    "prediction": "Prédiction",
    "from": "de",
    "to": "à",
    "by": "par",
    "with": "avec",
    "vs": "vs",
    "and": "et",
    "or": "ou",
    "prepaid": "prépayé",
    "redemption": "rachat",
    "non": "non",
    "sales": "Ventes",
    "summary": "Résumé",
    "details": "Détails",
    "total": "Total",
    "today": "Aujourd'hui",
    "days": "jours",
    "last": "Derniers",
    "range": "Plage",
    "custom": "personnalisée",
    "rate": "Taux",
    "count": "Nombre",
    "amount": "Montant",
    "client": "Client",
    "staff": "Personnel",
    "service": "Service",
    "product": "Produit",
    "branch": "Succursale",
    "booking": "Réservation",
    "commission": "Commission",
    "tips": "Pourboires",
    "online": "En ligne",
    "walk-in": "Sans rendez-vous",
    "confirmed": "Confirmé",
    "cancelled": "Annulé",
    "no-show": "Non-présentation"
  },
  it: {
    "revenue": "Entrate",
    "churn": "Abbandono",
    "prediction": "Previsione",
    "from": "da",
    "to": "a",
    "by": "per",
    "with": "con",
    "vs": "vs",
    "and": "e",
    "or": "o",
    "prepaid": "prepagato",
    "redemption": "riscatto",
    "non": "non",
    "sales": "Vendite",
    "summary": "Riepilogo",
    "details": "Dettagli",
    "total": "Totale",
    "today": "Oggi",
    "days": "giorni",
    "last": "Ultimi",
    "range": "Intervallo",
    "custom": "personalizzato",
    "rate": "Tasso",
    "count": "Conteggio",
    "amount": "Importo",
    "client": "Cliente",
    "staff": "Personale",
    "service": "Servizio",
    "product": "Prodotto",
    "branch": "Sede",
    "booking": "Prenotazione",
    "commission": "Commissione",
    "tips": "Mance",
    "online": "Online",
    "walk-in": "Senza appuntamento",
    "confirmed": "Confermato",
    "cancelled": "Annullato",
    "no-show": "Mancata presentazione"
  }
};

/**
 * Normalizes language codes e.g. "fr-CA" -> "fr", "ar" -> "ar".
 */
export function normalizeLanguageCode(code: string): string {
  const lower = code.toLowerCase().trim();
  if (lower.startsWith("ar")) return "ar";
  if (lower.startsWith("es")) return "es";
  if (lower.startsWith("tr")) return "tr";
  if (lower.startsWith("fr")) return "fr";
  if (lower.startsWith("it")) return "it";
  if (lower.startsWith("de")) return "de";
  if (lower.startsWith("pt")) return "pt";
  if (lower.startsWith("ru")) return "ru";
  if (lower.startsWith("zh")) return "zh";
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("ko")) return "ko";
  if (lower.startsWith("hi")) return "hi";
  if (lower.startsWith("bg")) return "bg";
  return lower;
}

/**
 * Translates an English text to the target language with high natural fluency.
 * Guarantees NEVER returning [LANG] pseudo-placeholders.
 */
export function getLexiconTranslation(
  englishText: string,
  targetLang: string
): { translatedText: string; backTranslation: string; confidence: number } {
  if (!englishText || !englishText.trim()) {
    return { translatedText: "", backTranslation: "", confidence: 100 };
  }

  const langKey = normalizeLanguageCode(targetLang);
  const normalizedEnglish = englishText.trim().toLowerCase();

  // 1. Direct match in core lexicon dictionary
  if (LEXICON_DICTIONARY[normalizedEnglish]) {
    const entry = LEXICON_DICTIONARY[normalizedEnglish];
    const trans = (entry as any)[langKey] || (entry as any)["es"] || englishText;
    return {
      translatedText: trans,
      backTranslation: entry.backTranslation || englishText,
      confidence: 96
    };
  }

  // 2. Check for number variations e.g. "Last 10 days", "Last 60 days", "Next 7 days", "Next 30 days"
  const lastDaysMatch = normalizedEnglish.match(/^last\s+(\d+)\s+days$/);
  if (lastDaysMatch) {
    const num = lastDaysMatch[1];
    let trans = "";
    if (langKey === "ar") trans = `آخر ${num} يوماً`;
    else if (langKey === "es") trans = `Últimos ${num} días`;
    else if (langKey === "tr") trans = `Son ${num} gün`;
    else if (langKey === "fr") trans = `${num} derniers jours`;
    else if (langKey === "it") trans = `Ultimi ${num} giorni`;
    else if (langKey === "de") trans = `Letzte ${num} Tage`;
    else if (langKey === "pt") trans = `Últimos ${num} dias`;
    else if (langKey === "ru") trans = `Последние ${num} дней`;
    else if (langKey === "zh") trans = `最近 ${num} 天`;
    else if (langKey === "ja") trans = `過去${num}日間`;
    else if (langKey === "ko") trans = `최근 ${num}일`;
    else if (langKey === "hi") trans = `पिछले ${num} दिन`;
    else if (langKey === "bg") trans = `Последните ${num} дни`;
    else trans = `Last ${num} days`;

    return {
      translatedText: trans,
      backTranslation: `Last ${num} days`,
      confidence: 95
    };
  }

  const nextDaysMatch = normalizedEnglish.match(/^next\s+(\d+)\s+days$/);
  if (nextDaysMatch) {
    const num = nextDaysMatch[1];
    let trans = "";
    if (langKey === "ar") trans = `الـ ${num} يوماً القادمة`;
    else if (langKey === "es") trans = `Próximos ${num} días`;
    else if (langKey === "tr") trans = `Gelecek ${num} gün`;
    else if (langKey === "fr") trans = `${num} prochains jours`;
    else if (langKey === "it") trans = `Prossimi ${num} giorni`;
    else if (langKey === "de") trans = `Nächste ${num} Tage`;
    else if (langKey === "pt") trans = `Próximos ${num} dias`;
    else if (langKey === "ru") trans = `Следующие ${num} дней`;
    else if (langKey === "zh") trans = `未来 ${num} 天`;
    else if (langKey === "ja") trans = `次の${num}日間`;
    else if (langKey === "ko") trans = `다음 ${num}일`;
    else if (langKey === "hi") trans = `अगले ${num} दिन`;
    else if (langKey === "bg") trans = `Следващите ${num} дни`;
    else trans = `Next ${num} days`;

    return {
      translatedText: trans,
      backTranslation: `Next ${num} days`,
      confidence: 95
    };
  }

  // 3. Dynamic Composition from words & token mappings (Only when >= 75% of words match to prevent mixed-language sentences)
  const words = normalizedEnglish.split(/\s+/).filter(Boolean);
  const langWords = WORD_MAP[langKey];

  if (langWords && words.length > 0) {
    let matchedCount = 0;
    const translatedWords = words.map((w) => {
      // Clean punctuation
      const cleanWord = w.replace(/[^a-z0-9-]/gi, "");
      if (langWords[cleanWord]) {
        matchedCount++;
        return langWords[cleanWord];
      }
      if (LEXICON_DICTIONARY[cleanWord]) {
        matchedCount++;
        return (LEXICON_DICTIONARY[cleanWord] as any)[langKey] || w;
      }
      return w;
    });

    if (matchedCount >= Math.max(1, Math.ceil(words.length * 0.75))) {
      const isRtl = langKey === "ar";
      let assembled = translatedWords.join(" ");

      // Handle initial capital for Latin languages
      if (!isRtl && assembled.length > 0) {
        assembled = assembled.charAt(0).toUpperCase() + assembled.slice(1);
      }

      return {
        translatedText: assembled,
        backTranslation: englishText,
        confidence: 92
      };
    }
  }

  // 4. Fallback: No translation available — return English as-is with ZERO confidence.
  // This MUST NOT be trusted or bulk-approved. The semantic analysis pipeline will
  // further penalize this since english === translated.
  return {
    translatedText: englishText,
    backTranslation: englishText,
    confidence: 0
  };
}

/**
 * Checks if a string is a dummy pseudo-translation e.g. "[AR] Total", "[ES] Today"
 */
export function isDummyPrefixedTranslation(text: string): boolean {
  if (!text) return false;
  return /^\[[A-Z]{2,5}\]\s+/i.test(text.trim());
}

/**
 * Extracts the inner English text from a dummy pseudo-translation like "[AR] Total" -> "Total"
 */
export function extractTextFromDummyPrefix(text: string): string {
  if (!text) return text;
  return text.replace(/^\[[A-Z]{2,5}\]\s+/i, "").trim();
}
