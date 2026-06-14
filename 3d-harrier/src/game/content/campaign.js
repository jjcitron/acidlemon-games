import { STAGES } from './stages.js';

export const CAMPAIGN_SEQUENCE = STAGES.map(stage => stage.id);

export const BOSS_RUSH_SEQUENCE = [
  'godarni',
  'domWave',
  'lowrys',
  'tetras',
  'wiwi'
];

export function getNextStageId(stageDef) {
  if (!stageDef || stageDef.custom) return null;
  if (stageDef.nextStageId !== undefined) return stageDef.nextStageId;
  const index = CAMPAIGN_SEQUENCE.indexOf(stageDef.id);
  return index >= 0 ? (CAMPAIGN_SEQUENCE[index + 1] || null) : null;
}

export function isFinalStage(stageDef) {
  if (!stageDef || stageDef.custom) return false;
  if (stageDef.boss?.final) return true;
  if (stageDef.bossRush?.some(boss => boss.final)) return true;
  return getNextStageId(stageDef) === null;
}

export function getCampaignStageCount() {
  return CAMPAIGN_SEQUENCE.length;
}
