import assert from 'node:assert/strict';
import { GRADE_BANDS, LESSON_THEMES, generateLessonPlan, validateLessonPlan } from './steam-lessons.js';

let checked = 0;
for (const band of GRADE_BANDS) {
  for (const theme of LESSON_THEMES) {
    for (let seed = 1; seed <= 20; seed++) {
      const options = {
        bandId: band.id,
        themeId: theme.id,
        seed,
        anchor: { tribeId: 'thao', tribeName: '邵族', buildingImage: 'building.jpg', materialName: '木頭', materialImage: 'wood.png' }
      };
      const plan = generateLessonPlan(options);
      assert.deepEqual(validateLessonPlan(plan), [], `${band.id}/${theme.id}/${seed} 驗證失敗`);
      assert.equal(JSON.stringify(plan), JSON.stringify(generateLessonPlan(options)), '相同 seed 應產生相同教案');
      assert.ok(!JSON.stringify(plan).includes('undefined'), '不得產生 undefined');
      assert.equal(plan.anchor.tribeName, '邵族');
      checked++;
    }
  }
}

const randomA = generateLessonPlan({ bandId: 'junior_high', themeId: 'random', seed: 7788 });
const randomB = generateLessonPlan({ bandId: 'junior_high', themeId: 'random', seed: 7788 });
assert.equal(randomA.theme.id, randomB.theme.id, '隨機主題也必須能以 seed 重現');

console.log(`STEAM 教案測試通過：${checked} 份固定組合與隨機重現檢查`);
