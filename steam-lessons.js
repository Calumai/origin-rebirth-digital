export const GRADE_BANDS = [
  {
    id: 'elementary_1_2', code: 'E12', label: '國小 1-2 年級', shortLabel: '小一至小二', minutes: 40, groupSize: '2-3 人',
    stageNote: '以生活課程式的觀察、分類、動手做與口語表達為主，不包裝成正式科學研究。',
    learningGoals: ['說出卡面上實際看見的兩個特徵', '用乾濕、站倒或冷熱等詞記錄測試', '提出一個可以改進模型的方法'],
    steam: {
      S: '觀察乾濕、站倒、冷熱或材料變化。',
      T: '由教師協助拍照，記錄測試前後。',
      E: '搭一個能接受測試的小模型，試過後再改一次。',
      A: '畫出自己的設計與修改，不模仿未經授權的族群圖紋。',
      M: '數一數、排順序，或比較哪一個較多、較少、較快。'
    },
    assessment: { type: '教師觀察勾選', criteria: ['能分辨看見與猜想', '能完成一次測試', '能說出一項修改'] },
    differentiation: { support: '提供圖卡、句型與已剪好的基本形狀。', extension: '請學生比較兩個模型，說明哪一個更符合任務。' }
  },
  {
    id: 'elementary_3_4', code: 'E34', label: '國小 3-4 年級', shortLabel: '小三至小四', minutes: 45, groupSize: '3-4 人',
    stageNote: '從觀察進入測量、比較與簡單的證據說明。',
    learningGoals: ['把卡面觀察與推測分開記錄', '使用尺、量杯或計時器取得簡單數據', '用「我的答案、我的證據」說明結果'],
    steam: {
      S: '比較不同條件下的可觀察變化。',
      T: '使用計時器、相機或簡單表格記錄。',
      E: '依任務限制搭建、測試並修改模型。',
      A: '用草圖、箭頭與色塊清楚表達設計。',
      M: '量長度、時間或水量，整理成簡單表格。'
    },
    assessment: { type: '證據句學習單', criteria: ['觀察紀錄具體', '數據可讀', '結論有引用測試結果'] },
    differentiation: { support: '提供半完成表格與「我認為，因為數據顯示」句型。', extension: '要求說明測試不公平的地方，並提出修正。' }
  },
  {
    id: 'elementary_5_6', code: 'E56', label: '國小 5-6 年級', shortLabel: '小五至小六', minutes: 90, groupSize: '3-4 人',
    stageNote: '練習公平測試、控制變因、資料表與依證據修正設計。',
    learningGoals: ['辨識自變因、應變因與控制條件', '完成至少三次可比較的測試', '用資料支持設計修改'],
    steam: {
      S: '設計公平測試並控制主要變因。',
      T: '用試算表或數位計時工具整理資料。',
      E: '在材料限制內完成兩輪原型迭代。',
      A: '製作有圖例、標示與資料的設計海報。',
      M: '計算平均值、差異或比例，辨認資料趨勢。'
    },
    assessment: { type: '公平測試規準', criteria: ['變因清楚', '資料完整', '結論有證據', '修改能回應問題'] },
    differentiation: { support: '提供變因卡、測試流程卡與示例資料表。', extension: '加入第二項限制，比較方案取捨。' }
  },
  {
    id: 'junior_high', code: 'JH', label: '國中', shortLabel: '國中', minutes: 90, groupSize: '3-4 人',
    stageNote: '以系統、設計限制、A/B 原型與證據論證建立跨科連結。',
    learningGoals: ['從官方資料建立可測試的情境', '比較兩個原型在多項限制下的表現', '完成主張、證據、推理的 CER 論證'],
    steam: {
      S: '分析變因關係與模型限制。',
      T: '用試算表、感測器或影像記錄整理結果。',
      E: '依需求與限制製作 A/B 原型並迭代。',
      A: '用資訊設計呈現證據，不挪用未授權文化圖紋。',
      M: '比較平均值、變異與效能比，說明趨勢。'
    },
    assessment: { type: 'CER 設計論證', criteria: ['主張可回答問題', '證據可追溯', '推理合理', '能說明模型限制'] },
    differentiation: { support: '提供資料摘要、CER 結構與角色分工卡。', extension: '要求找出一項相反證據，修正原本主張。' }
  },
  {
    id: 'senior_high', code: 'SH', label: '高中', shortLabel: '高中', minutes: 100, groupSize: '3-5 人',
    stageNote: '以模型假設、不確定性、多準則取捨、資料品質與文化權利進行設計審查。',
    learningGoals: ['稽核資料來源、假設與不確定性', '建立多準則評估模型並說明權重', '提出可辯護且尊重文化權利的設計建議'],
    steam: {
      S: '建立情境模型，辨識假設、不確定性與外推限制。',
      T: '使用試算表、感測資料或視覺化工具處理證據。',
      E: '在效能、成本、耐久與倫理限制間迭代方案。',
      A: '以資訊視覺與口頭設計審查呈現取捨。',
      M: '使用正規化、加權矩陣或敏感度分析比較方案。'
    },
    assessment: { type: '多準則設計審查', criteria: ['模型假設透明', '資料品質有稽核', '方案取捨可辯護', '文化來源與權利有檢核'] },
    differentiation: { support: '提供資料字典、加權矩陣模板與來源稽核表。', extension: '改變權重或氣候情境，進行敏感度分析。' }
  }
];

export const LESSON_THEMES = [
  {
    id: 'rain_roof', title: '雨水與屋頂', climateFrame: '臺灣常見多雨與颱風等情境，可作為模型排水與滲水測試的背景。',
    bigQuestions: {
      elementary_1_2: '怎樣讓模型裡的小紙人少淋到雨？',
      elementary_3_4: '改變屋頂角度或覆面方式，哪一項更能減少進水？',
      elementary_5_6: '在相同水量與高度下，屋頂角度如何影響排水時間與滲水量？',
      junior_high: '如何在用料限制內，同時改善防水與排水表現？',
      senior_high: '在降雨情境、成本、材料壽命與證據不足時，如何提出可辯護的屋頂方案？'
    },
    test: '使用相同水量與高度模擬降雨，記錄排水時間與模型內部進水情形。',
    focus: '角度、覆面方式、排水路徑', materials: ['量杯或滴管', '托盤', '吸水紙']
  },
  {
    id: 'wind_stability', title: '風與結構穩定', climateFrame: '颱風可能帶來強風，適合轉化為模型的側向受力測試情境。',
    bigQuestions: {
      elementary_1_2: '怎樣讓模型吹風時比較不容易倒？',
      elementary_3_4: '底部寬度和支撐方式，哪一項更影響模型穩定？',
      elementary_5_6: '在相同風力與距離下，底部寬度如何影響模型位移？',
      junior_high: '如何在高度與用料限制內，提高模型的側向穩定性？',
      senior_high: '如何以受力模型、材料效率與安全係數比較抗風方案？'
    },
    test: '固定風源、距離與時間，記錄模型傾斜、位移或倒下的風速等級。',
    focus: '底面、支撐、重心', materials: ['電風扇或紙板扇', '距離標線', '直尺']
  },
  {
    id: 'heat_airflow', title: '遮陽與空氣流動', climateFrame: '臺灣高溫情境可轉化為遮陽與通風模型的比較任務。',
    bigQuestions: {
      elementary_1_2: '怎樣讓模型裡面比較不悶熱？',
      elementary_3_4: '開口位置和遮陽片，哪一項更能幫助空氣流動？',
      elementary_5_6: '在相同熱源下，開口面積如何影響模型內溫度變化？',
      junior_high: '如何在採光、遮陽與通風需求間做設計取捨？',
      senior_high: '如何用熱環境資料與被動式設計指標，評估遮陽通風方案？'
    },
    test: '固定熱源距離與時間，比較開口或遮陽配置前後的溫度或紙帶擺動。',
    focus: '開口、遮陽、空氣路徑', materials: ['安全低溫燈源', '溫度計或紙帶', '計時器']
  },
  {
    id: 'material_properties', title: '材料性質與選擇', climateFrame: '氣候測試需要把吸水、彎曲、重量等材料表現分開量測，結果只代表教室模型。',
    bigQuestions: {
      elementary_1_2: '哪一種模型材料遇到水或風吹時變化比較小？',
      elementary_3_4: '不同材料的吸水與承重表現有什麼差別？',
      elementary_5_6: '如何用公平測試比較材料的吸水率、強度與重量？',
      junior_high: '如何依效能、用量與可重複使用性選擇模型材料？',
      senior_high: '如何建立材料選擇矩陣，並處理數據不足與測試尺度限制？'
    },
    test: '以相同尺寸與測試時間，比較材料的吸水、彎曲、承重或重量。',
    focus: '吸水、強度、重量', materials: ['電子秤或砝碼', '滴管', '相同尺寸試片']
  },
  {
    id: 'climate_adaptation', title: '聚落配置與氣候韌性', climateFrame: '高溫、多雨與颱風等條件可作為模型聚落的複合氣候情境。',
    bigQuestions: {
      elementary_1_2: '模型房子放在哪裡，比較不會積水又能吹到風？',
      elementary_3_4: '房屋間距和地面高低，如何影響排水與通風？',
      elementary_5_6: '如何控制地形與間距，公平比較不同聚落配置？',
      junior_high: '如何在排水、通風、動線與用地限制間設計模型聚落？',
      senior_high: '如何用多準則與情境分析，評估模型聚落的氣候韌性方案？'
    },
    test: '在固定地形盤上改變間距、方向或高程，依雨水與風的測試結果評估配置。',
    focus: '間距、方向、高程、動線', materials: ['地形底板', '方位標記', '量杯與風源']
  }
];

export const LESSON_SOURCES = [
  { id: 'naer-curriculum', label: '國家教育研究院：十二年國民基本教育課程綱要', url: 'https://www.naer.edu.tw/PageSyllabus?fid=52', kind: '課程依據' },
  { id: 'cwa-education', label: '中央氣象署：氣候教育服務', url: 'https://climate.cwa.gov.tw/Education', kind: '官方氣候資料' },
  { id: 'cwa-taiwan-climate', label: '中央氣象署：臺灣氣候', url: 'https://south.cwa.gov.tw/inner/raMT1572423889ELUy', kind: '官方氣候資料' },
  { id: 'cwa-typhoon', label: '中央氣象署：颱風科普', url: 'https://pweb.cwa.gov.tw/PopularScience/kids/wt/wt_2.html', kind: '官方氣候資料' },
  { id: 'cip-culture', label: '原住民族委員會原住民族歷史文化資訊網', url: 'https://ihc.cip.gov.tw/', kind: '文化資料入口' }
];

const SEQUENCE_BLUEPRINTS = {
  elementary_1_2: [
    [5, '看卡說一說', '引導學生只說卡面實際看見的形狀、線條與位置。', '輪流說出兩個看見的特徵。', '口語觀察'],
    [5, '認識今天的天氣問題', '用圖片或簡短官方資料介紹測試情境。', '把天氣情境和模型任務連起來。', '問題預測'],
    [15, '一起搭模型', '提醒安全與材料限制，不示範唯一答案。', '分工搭建第一版模型。', '設計草圖與模型'],
    [8, '試一試', '用固定方式進行測試並協助拍照。', '觀察乾濕、站倒、冷熱或其他變化。', '測試前後照片'],
    [7, '改一個地方再分享', '用「我改了，結果」句型收束。', '修改一處並說明結果。', '口頭離堂票']
  ],
  elementary_3_4: [
    [5, '看見與推測', '示範把觀察和猜想寫在不同欄。', '記錄卡面觀察與一個待驗證推測。', '雙欄紀錄'],
    [8, '讀氣候線索', '選讀一小段官方氣候資料並說明來源。', '圈出和任務有關的天氣條件。', '來源標記'],
    [15, '搭建模型', '確認各組只改一項主要設計。', '畫圖並完成第一版模型。', '設計圖'],
    [10, '測量比較', '協助固定測試條件與工具讀值。', '量測並完成簡單表格。', '數據表'],
    [7, '用證據回答', '提供證據句型並追問數據。', '用答案與證據分享結果。', '證據句']
  ],
  elementary_5_6: [
    [10, '來源分類', '帶領辨識官方資料、遊戲卡牌與學生假設。', '完成來源三分法。', '來源分類表'],
    [15, '閱讀氣候資料', '協助找出測試情境、單位與限制。', '摘錄可用資料並提出問題。', '資料摘錄'],
    [15, '設計公平測試', '檢查自變因、應變因與控制條件。', '完成變因表與測試步驟。', '變因表'],
    [25, '搭建與第一輪測試', '巡視材料使用與測試一致性。', '完成模型並至少測試三次。', '原始數據'],
    [15, '分析與修改', '引導計算平均或差異。', '依資料修改模型並再測一次。', '比較表'],
    [10, '證據發表', '追問結論是否超出模型能證明的範圍。', '用圖表說明結果與限制。', '小組海報']
  ],
  junior_high: [
    [10, '任務與來源稽核', '說明遊戲卡不是文化史料，建立來源規則。', '標示每項資訊的來源狀態。', '來源檢核'],
    [15, '建立氣候情境', '引導從官方資料選擇可測條件。', '定義測試情境與合理範圍。', '情境說明'],
    [15, '需求與限制', '要求列出效能、材料與時間限制。', '完成需求矩陣與分工。', '設計規格'],
    [25, 'A/B 原型測試', '確認兩版原型的測試條件一致。', '製作 A/B 原型並收集數據。', 'A/B 數據'],
    [15, '分析與迭代', '引導辨識誤差與模型限制。', '比較結果並改良較弱方案。', '分析表'],
    [10, 'CER 論證', '用反例追問主張是否站得住腳。', '完成主張、證據、推理與限制。', 'CER 短講']
  ],
  senior_high: [
    [10, '證據與權利稽核', '要求揭露資料來源、文化審校狀態與使用界線。', '完成來源、權利與不確定性檢核。', '稽核表'],
    [20, '建立資料模型', '引導選擇變數、尺度與情境。', '建立可計算或可測試的模型。', '模型假設表'],
    [15, '需求、限制與權重', '挑戰各項權重是否合理。', '完成多準則矩陣與權重說明。', '決策矩陣'],
    [25, '原型與測試', '監看測試一致性與資料品質。', '製作原型並取得足夠數據。', '原始資料集'],
    [20, '取捨與敏感度分析', '要求改變一項假設或權重。', '比較方案並檢查結論是否改變。', '敏感度圖表'],
    [10, '設計審查', '以證據、限制與文化安全提出質詢。', '提出建議、反思限制並列出後續查證。', '審查簡報']
  ]
};

function seededRng(seed) {
  let value = Number(seed) >>> 0;
  return () => {
    value |= 0;
    value = (value + 0x6D2B79F5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(list, rng) { return list[Math.floor(rng() * list.length)]; }

export function generateLessonPlan({ bandId, themeId = 'random', seed = Date.now(), anchor = null } = {}) {
  const normalizedSeed = Number(seed) >>> 0;
  const rng = seededRng(normalizedSeed);
  const band = GRADE_BANDS.find(item => item.id === bandId) || GRADE_BANDS[0];
  const theme = themeId === 'random'
    ? pick(LESSON_THEMES, rng)
    : (LESSON_THEMES.find(item => item.id === themeId) || LESSON_THEMES[0]);
  const safeAnchor = {
    tribeId: anchor?.tribeId || 'game-prototype',
    tribeName: anchor?.tribeName || '遊戲族群卡',
    buildingImage: anchor?.buildingImage || '',
    materialName: anchor?.materialName || '遊戲素材卡',
    materialImage: anchor?.materialImage || ''
  };
  const roleSets = [
    ['觀察員', '建造員', '記錄員', '分享員'],
    ['資料員', '材料員', '測試員', '報告員'],
    ['來源查核', '原型設計', '實驗記錄', '證據辯護']
  ];
  const sequence = SEQUENCE_BLUEPRINTS[band.id].map(([minutes, title, teacherAction, studentAction, evidence]) => ({ minutes, title, teacherAction, studentAction, evidence }));
  const allMaterials = ['遊戲建築卡觀察圖', `${safeAnchor.materialName}遊戲素材卡`, '回收紙材', '紙膠帶', '剪刀與書寫工具', ...theme.materials];
  const sourceIds = theme.id === 'wind_stability' || theme.id === 'climate_adaptation'
    ? ['naer-curriculum', 'cwa-education', 'cwa-taiwan-climate', 'cwa-typhoon', 'cip-culture']
    : ['naer-curriculum', 'cwa-education', 'cwa-taiwan-climate', 'cip-culture'];
  return {
    schemaVersion: 1,
    id: `STEAM-${band.code}-${normalizedSeed.toString(36).toUpperCase()}`,
    seed: normalizedSeed,
    band: { id: band.id, label: band.label, shortLabel: band.shortLabel, minutes: band.minutes, groupSize: band.groupSize, stageNote: band.stageNote },
    theme: { id: theme.id, title: theme.title, focus: theme.focus },
    anchor: safeAnchor,
    bigQuestion: theme.bigQuestions[band.id],
    climateFrame: theme.climateFrame,
    learningGoals: band.learningGoals.slice(),
    steam: { ...band.steam },
    roles: pick(roleSets, rng),
    materials: [...new Set(allMaterials)],
    test: theme.test,
    sequence,
    assessment: { type: band.assessment.type, criteria: band.assessment.criteria.slice() },
    differentiation: { ...band.differentiation },
    evidenceLedger: [
      { status: 'game-artifact', label: '看見', text: `只描述「${safeAnchor.tribeName}」建築遊戲卡與「${safeAnchor.materialName}」素材卡上實際看得到的內容。` },
      { status: 'student-hypothesis', label: '推測', text: '把卡面觀察轉成可測試的模型假設，使用「可能」與「我們要測試」等語句。' },
      { status: 'official', label: '來源證實', text: '氣候情境只引用已列出的官方資料。特定族群建築知識目前沒有核准資料，不得由模型結果代替。' }
    ],
    claims: [
      { status: 'official', text: theme.climateFrame, sourceIds: sourceIds.filter(id => id.startsWith('cwa-')) },
      { status: 'game-artifact', text: '建築與素材圖像是遊戲原型觀察物，不是文化史料。', sourceIds: [] },
      { status: 'review-required', text: `任何關於${safeAnchor.tribeName}真實家屋、材料、環境適應或文化意義的敘述，都須由該族文化顧問與可追溯來源審校。`, sourceIds: ['cip-culture'] }
    ],
    cultureSafety: [
      '不得從卡面或模型結果推論特定族群的真實建築知識。',
      '不得要求學生臨摹、拼貼或改作未經授權的原住民族圖紋。',
      '發表時要分清楚看見、推測與來源證實。',
      '未來文化內容只有在審校通過、來源完整、具名審閱者與審閱日期齊備後，才能加入隨機池。'
    ],
    sources: LESSON_SOURCES.filter(source => sourceIds.includes(source.id)).map(source => ({ ...source }))
  };
}

export function validateLessonPlan(plan) {
  const errors = [];
  if (!plan || !plan.band || !plan.theme) errors.push('缺少學段或主題');
  const minuteTotal = plan?.sequence?.reduce((sum, step) => sum + step.minutes, 0) || 0;
  if (minuteTotal !== plan?.band?.minutes) errors.push(`活動分鐘 ${minuteTotal} 不等於課程分鐘 ${plan?.band?.minutes}`);
  for (const key of ['S', 'T', 'E', 'A', 'M']) if (!plan?.steam?.[key]) errors.push(`缺少 STEAM ${key}`);
  if (!plan?.evidenceLedger?.some(item => item.status === 'official')) errors.push('缺少官方來源證實欄');
  if (!plan?.claims?.some(item => item.status === 'review-required')) errors.push('缺少文化審校閘門');
  const sourceIds = new Set((plan?.sources || []).map(source => source.id));
  for (const claim of plan?.claims || []) {
    if (claim.status === 'official' && (!claim.sourceIds.length || claim.sourceIds.some(id => !sourceIds.has(id)))) errors.push('官方主張缺少已登錄來源');
  }
  return errors;
}
