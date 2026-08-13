import type {Character} from './types.js';

export const DDB_FEAT_SELECTION_EVIDENCE='Altered verified D&D Beyond feat selections';

export function migratePersistedCharacter(character:Character):{character:Character;repairs:string[]} {
  const legacyFerocitus=character.provenance.provider==='dndbeyond'&&character.provenance.sourceId==='152187683'&&!character.provenance.rulesetEvidence.includes(DDB_FEAT_SELECTION_EVIDENCE);
  const hasPlaceholder=character.feats.some(feat=>feat.trim().toLowerCase()==='dark bargain');
  if(!legacyFerocitus||!hasPlaceholder)return {character,repairs:[]};
  return {
    character:{...character,feats:character.feats.filter(feat=>feat.trim().toLowerCase()!=='dark bargain')},
    repairs:['Removed the unfinished Dark Bargain feat choice from the older Ferocitus import.'],
  };
}
