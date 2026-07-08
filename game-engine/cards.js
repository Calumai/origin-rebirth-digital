export const CARDS = {
  materials: ['木頭', '竹子', '茅草', '石頭'],
  tribes: {
    thao:    { name: '邵族',       produces: ['木頭', '竹子', '茅草'] },
    kavalan: { name: '噶瑪蘭族',   produces: ['竹子', '茅草', '石頭'] },
    hlaalua: { name: '拉阿魯哇族', produces: ['木頭', '石頭', '茅草'] },
    seediq:  { name: '賽德克族',   produces: ['木頭', '竹子', '茅草'] }
  },
  rawCardTypes: [
    { id: 'iron',        name: '鐵礦',       craft: 'thao_knife' },
    { id: 'fire',        name: '火',         craft: 'thao_knife' },
    { id: 'banana',      name: '香蕉絲',     craft: 'kavalan_weave' },
    { id: 'loom',        name: '織布機',     craft: 'kavalan_weave' },
    { id: 'bamboo_raw',  name: '竹子(原料)', craft: 'hlaalua_bow' },
    { id: 'shellflower', name: '月桃葉纖維', craft: 'hlaalua_bow' },
    { id: 'vine',        name: '黃鱔藤',     craft: 'seediq_basket' },
    { id: 'bark',        name: '竹皮',       craft: 'seediq_basket' }
  ],
  rawCopiesPerType: 3,
  crafts: {
    thao_knife:    { name: '邵族刀',         tribe: 'thao',    score: 5 },
    kavalan_weave: { name: '香蕉絲編織織布', tribe: 'kavalan', score: 5 },
    hlaalua_bow:   { name: '弓琴',           tribe: 'hlaalua', score: 5 },
    seediq_basket: { name: '揹籃',           tribe: 'seediq',  score: 5 }
  },
  craftCopiesPerType: 2,
  cultureCards: [
    { id: 'food_thao',    name: '刺蔥',     tribe: 'thao',    effect: 'extra_action', score: 2, food: true },
    { id: 'food_kavalan', name: '海菜',     tribe: 'kavalan', effect: 'extra_action', score: 2, food: true },
    { id: 'food_hlaalua', name: '藤心',     tribe: 'hlaalua', effect: 'extra_action', score: 2, food: true },
    { id: 'food_seediq',  name: '燻烤山肉', tribe: 'seediq',  effect: 'extra_action', score: 2, food: true },
    { id: 'myth_amis',       name: '阿美族-七彩布裙的傳說',   effect: 'draw_building', score: 2 },
    { id: 'myth_atayal',     name: '泰雅族-占卜鳥希利克',     effect: 'draw_building', score: 2 },
    { id: 'myth_bunun',      name: '布農族-射日神話',         effect: 'draw_building', score: 2 },
    { id: 'myth_tsou',       name: '鄒族-天神造人',           effect: 'draw_building', score: 2 },
    { id: 'myth_paiwan',     name: '排灣族-雙管笛傳說',       effect: 'draw_craft',    score: 2 },
    { id: 'myth_kanakanavu', name: '卡那卡那富族-六趾大善人', effect: 'draw_craft',    score: 2 },
    { id: 'myth_sakizaya',   name: '撒奇萊雅族-美女巴奈',     effect: 'draw_craft',    score: 2 },
    { id: 'myth_saisiyat',   name: '賽夏族-巴斯達隘',         effect: 'steal_2',       score: 2 },
    { id: 'myth_rukai',      name: '魯凱族-蒼蠅取火',         effect: 'steal_2',       score: 2 },
    { id: 'myth_hlaalua',    name: '拉阿魯哇族-貝神',         effect: 'steal_2',       score: 2 },
    { id: 'myth_thao',       name: '邵族-貓頭鷹傳說',         effect: 'defend_raid',   score: 2 },
    { id: 'myth_truku',      name: '太魯閣族-神木傳說',       effect: 'defend_raid',   score: 2 },
    { id: 'myth_puyuma',     name: '卑南族-神鹿與公主',       effect: 'defend_raid',   score: 2 },
    { id: 'myth_seediq',     name: '賽德克族-白石傳說',       effect: 'gain_2_any',    score: 2 },
    { id: 'myth_kavalan',    name: '噶瑪蘭族-歌舞的起源',     effect: 'gain_2_any',    score: 2 },
    { id: 'myth_yami',       name: '雅美族-飛魚之神',         effect: 'gain_2_any',    score: 2 }
  ],
  buildingsPerTribe: 4,
  buildingScore: 3,
  clothing: { parts: { head: 2, body: 3 }, genders: ['male', 'female'], pairScore: 5 },
  bonuses: {
    fullOwnBuildingSet: 5,
    fullCraftSet: 2,
    fullFoodSet: 3,
    ownTribeDollBothGenders: 5
  }
};
