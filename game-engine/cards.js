export const CARDS = {
  materials: ['木頭', '竹子', '茅草', '石頭'],
  materialImages: { '木頭': 'assets/materials/wood.png', '竹子': 'assets/materials/bamboo.png', '茅草': 'assets/materials/thatch.png', '石頭': 'assets/materials/stone.png' },
  tribes: {
    thao:    { name: '邵族',       produces: ['木頭', '竹子', '茅草'], img: 'assets/tribes/thao.png' },
    kavalan: { name: '噶瑪蘭族',   produces: ['竹子', '茅草', '石頭'], img: 'assets/tribes/kavalan.png' },
    hlaalua: { name: '拉阿魯哇族', produces: ['木頭', '石頭', '茅草'], img: 'assets/tribes/hlaalua.png' },
    seediq:  { name: '賽德克族',   produces: ['木頭', '竹子', '茅草'], img: 'assets/tribes/seediq.png' }
  },
  rawCardTypes: [
    { id: 'iron',        name: '鐵礦',       craft: 'thao_knife',    img: 'assets/raw/iron.png' },
    { id: 'fire',        name: '火',         craft: 'thao_knife',    img: 'assets/raw/fire.png' },
    { id: 'banana',      name: '香蕉絲',     craft: 'kavalan_weave', img: 'assets/raw/banana.png' },
    { id: 'loom',        name: '織布機',     craft: 'kavalan_weave', img: 'assets/raw/loom.png' },
    { id: 'bamboo_raw',  name: '竹子(原料)', craft: 'hlaalua_bow',   img: 'assets/raw/bamboo_raw.png' },
    { id: 'shellflower', name: '月桃葉纖維', craft: 'hlaalua_bow',   img: 'assets/raw/shellflower.png' },
    { id: 'vine',        name: '黃鱔藤',     craft: 'seediq_basket', img: 'assets/raw/vine.png' },
    { id: 'bark',        name: '竹皮',       craft: 'seediq_basket', img: 'assets/raw/bark.png' }
  ],
  rawCopiesPerType: 3,
  crafts: {
    thao_knife:    { name: '邵族刀',         tribe: 'thao',    score: 5, img: 'assets/craft/thao_knife.png' },
    kavalan_weave: { name: '香蕉絲編織織布', tribe: 'kavalan', score: 5, img: 'assets/craft/kavalan_weave.png' },
    hlaalua_bow:   { name: '弓琴',           tribe: 'hlaalua', score: 5, img: 'assets/craft/hlaalua_bow.png' },
    seediq_basket: { name: '揹籃',           tribe: 'seediq',  score: 5, img: 'assets/craft/seediq_basket.png' }
  },
  craftCopiesPerType: 2,
  cultureCards: [
    { id: 'food_thao',    name: '刺蔥',     tribe: 'thao',    effect: 'extra_action', score: 2, food: true, img: 'assets/food/thao.png' },
    { id: 'food_kavalan', name: '海菜',     tribe: 'kavalan', effect: 'extra_action', score: 2, food: true, img: 'assets/food/kavalan.png' },
    { id: 'food_hlaalua', name: '藤心',     tribe: 'hlaalua', effect: 'extra_action', score: 2, food: true, img: 'assets/food/hlaalua.png' },
    { id: 'food_seediq',  name: '燻烤山肉', tribe: 'seediq',  effect: 'extra_action', score: 2, food: true, img: 'assets/food/seediq.png' },
    { id: 'myth_amis',       name: '阿美族-七彩布裙的傳說',   effect: 'draw_building', score: 3, img: 'assets/myth/amis.png' },
    { id: 'myth_atayal',     name: '泰雅族-占卜鳥希利克',     effect: 'draw_building', score: 3, img: 'assets/myth/atayal.png' },
    { id: 'myth_bunun',      name: '布農族-射日神話',         effect: 'draw_building', score: 3, img: 'assets/myth/bunun.png' },
    { id: 'myth_tsou',       name: '鄒族-天神造人',           effect: 'draw_building', score: 3, img: 'assets/myth/tsou.png' },
    { id: 'myth_paiwan',     name: '排灣族-雙管笛傳說',       effect: 'draw_craft',    score: 3, img: 'assets/myth/paiwan.png' },
    { id: 'myth_kanakanavu', name: '卡那卡那富族-六趾大善人', effect: 'draw_craft',    score: 3, img: 'assets/myth/kanakanavu.png' },
    { id: 'myth_sakizaya',   name: '撒奇萊雅族-美女巴奈',     effect: 'draw_craft',    score: 3, img: 'assets/myth/sakizaya.png' },
    { id: 'myth_saisiyat',   name: '賽夏族-巴斯達隘',         effect: 'steal_2',       score: 3, img: 'assets/myth/saisiyat.png' },
    { id: 'myth_rukai',      name: '魯凱族-蒼蠅取火',         effect: 'steal_2',       score: 3, img: 'assets/myth/rukai.png' },
    { id: 'myth_hlaalua',    name: '拉阿魯哇族-貝神',         effect: 'steal_2',       score: 3, img: 'assets/myth/hlaalua.png' },
    { id: 'myth_thao',       name: '邵族-貓頭鷹傳說',         effect: 'defend_raid',   score: 3, img: 'assets/myth/thao.png' },
    { id: 'myth_truku',      name: '太魯閣族-神木傳說',       effect: 'defend_raid',   score: 3, img: 'assets/myth/truku.png' },
    { id: 'myth_puyuma',     name: '卑南族-神鹿與公主',       effect: 'defend_raid',   score: 3, img: 'assets/myth/puyuma.png' },
    { id: 'myth_seediq',     name: '賽德克族-白石傳說',       effect: 'gain_2_any',    score: 3, img: 'assets/myth/seediq.png' },
    { id: 'myth_kavalan',    name: '噶瑪蘭族-歌舞的起源',     effect: 'gain_2_any',    score: 3, img: 'assets/myth/kavalan.png' },
    { id: 'myth_yami',       name: '雅美族-飛魚之神',         effect: 'gain_2_any',    score: 3, img: 'assets/myth/yami.png' }
  ],
  buildingsPerTribe: 4,
  buildingScore: 3,
  buildingImages: {
    thao: 'assets/buildings/thao.jpg',
    kavalan: 'assets/buildings/kavalan.jpg',
    hlaalua: 'assets/buildings/hlaalua.jpg',
    seediq: 'assets/buildings/seediq.jpg'
  },
  clothing: {
    parts: { head: 2, body: 3 },
    genders: ['male', 'female'],
    pairScore: 5,
    images: {
      thao:    { male: { head: 'assets/clothing/thao_male_head.png',    body: 'assets/clothing/thao_male_body.png' },    female: { head: 'assets/clothing/thao_female_head.png',    body: 'assets/clothing/thao_female_body.png' } },
      kavalan: { male: { head: 'assets/clothing/kavalan_male_head.png', body: 'assets/clothing/kavalan_male_body.png' }, female: { head: 'assets/clothing/kavalan_female_head.png', body: 'assets/clothing/kavalan_female_body.png' } },
      hlaalua: { male: { head: 'assets/clothing/hlaalua_male_head.png', body: 'assets/clothing/hlaalua_male_body.png' }, female: { head: 'assets/clothing/hlaalua_female_head.png', body: 'assets/clothing/hlaalua_female_body.png' } },
      seediq:  { male: { head: 'assets/clothing/seediq_male_head.png',  body: 'assets/clothing/seediq_male_body.png' },  female: { head: 'assets/clothing/seediq_female_head.png',  body: 'assets/clothing/seediq_female_body.png' } }
    }
  },
  cardBacks: {
    tribe: 'assets/backs/tribe.png',
    culture: 'assets/backs/culture.png',
    clothing: 'assets/backs/clothing.png',
    building: 'assets/backs/building.png',
    raw: 'assets/backs/raw.png',
    craft: 'assets/backs/craft.png',
    hint: 'assets/backs/hint.png'
  },
  bonuses: {
    fullOwnBuildingSet: 5,
    fullCraftSet: 2,
    fullFoodSet: 3,
    ownTribeDollBothGenders: 5,
    supportScoreCap: 5
  },

  // ── 公共事件卡（每輪翻一張，效果持續到下一張翻開；順序由 seed 決定）──
  events: [
    { id: 'harvest',         name: '豐收季',     category: '資源', desc: '本輪第一次拿素材時，額外獲得 1 枚本族盛產素材。' },
    { id: 'festival',        name: '文化祭典',   category: '文化', desc: '本輪每打出一張文化卡，額外獲得 1 分。' },
    { id: 'roadblock',       name: '山路封閉',   category: '環境', desc: '本輪不能交易，互助分享與共學交流仍可進行。' },
    { id: 'craftrace',       name: '工藝競賽',   category: '工藝', desc: '本輪第一位完成工藝的玩家獲得 2 分。' },
    { id: 'reinforce',       name: '家屋加固',   category: '建造', desc: '本輪蓋家屋所需行動點減少 1 點。' },
    { id: 'nightgather',     name: '夜間集會',   category: '交流', desc: '本輪第一次與其他玩家互動成功時，抽 1 張文化卡。' },
    { id: 'marketday',       name: '交流市集',   category: '交流', desc: '本輪交易或玩家購卡成功時，雙方第一次各獲得 1 互助分。' },
    { id: 'mutualaid',       name: '互助工班',   category: '互助', desc: '本輪互助分享的發起者額外獲得 1 互助分。' },
    { id: 'sharedstories',   name: '共學之夜',   category: '共學', desc: '本輪每位玩家第一次共學交流，退回 1 行動點。' },
    { id: 'clearweather',    name: '天候放晴',   category: '氣候', desc: '本輪擲出 1 至 2 點時，也能取得 3 行動點。' },
    { id: 'rainwatch',       name: '雨勢觀察',   category: '氣候', desc: '本輪第一次抽原料卡時，額外獲得 1 枚目前最少的素材。' },
    { id: 'materiallab',     name: '材料試驗',   category: 'STEAM', desc: '本輪每位玩家第一次抽原料卡不花行動點。' },
    { id: 'craftmentor',     name: '工藝共學',   category: '共學', desc: '本輪每位玩家第一次完成工藝時，再抽 1 張文化卡。' },
    { id: 'communityrepair', name: '聚落修繕',   category: '建造', desc: '本輪每位玩家第一次完成家屋時，額外獲得 1 分。' }
  ],

  // ── 秘密目標（開局每人 1 張，只有自己看得到；完成 +5 分）──
  objectiveBonus: 5,
  objectives: [
    { id: 'obj_house',     name: '家屋守護者', icon: '🏠', desc: '完成 4 間自己的家屋。',                 target: 4 },
    { id: 'obj_culture',   name: '文化傳承者', icon: '📜', desc: '打出 3 張文化卡。',                     target: 3 },
    { id: 'obj_craft',     name: '工藝大師',   icon: '🔨', desc: '完成 2 件不同工藝。',                   target: 2 },
    { id: 'obj_trade',     name: '部落商人',   icon: '🤝', desc: '完成 3 次交易或玩家購卡。',             target: 3 },
    { id: 'obj_collector', name: '素材收藏家', icon: '💎', desc: '遊戲結束時至少 3 種素材各 3 枚。',       target: 3 },
    { id: 'obj_social',    name: '跨族交流',   icon: '🌏', desc: '和至少 2 個不同玩家完成互動。',         target: 2 }
  ]
};
