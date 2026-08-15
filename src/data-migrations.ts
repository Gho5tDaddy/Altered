import type {Character} from './types.js';

export const DDB_FEAT_SELECTION_EVIDENCE='Altered verified D&D Beyond feat selections';

const FEROCITUS_WEAPONS:Record<string,NonNullable<Character['items'][number]['attack']>>={
  handaxe:{ability:'str',damage:'1d6',damageType:'Slashing',proficient:true,range:20,longRange:60,properties:['Light','Thrown','Vex'],magicBonus:0},
  greataxe:{ability:'str',damage:'1d12',damageType:'Slashing',proficient:true,properties:['Heavy','Two-Handed','Cleave'],magicBonus:0},
};

export function migratePersistedCharacter(character:Character):{character:Character;repairs:string[]} {
  // Early bundled copies used the same canonical character ID but carried local
  // provenance. Match that stable ID, not only the later provider metadata.
  const legacyFerocitus=character.id==='ddb-152187683'&&!character.provenance.rulesetEvidence.includes(DDB_FEAT_SELECTION_EVIDENCE);
  const hasPlaceholder=character.feats.some(feat=>feat.trim().toLowerCase()==='dark bargain');
  const repairs:string[]=[];
  let migrated=character;
  if(legacyFerocitus&&hasPlaceholder){
    migrated={...migrated,feats:migrated.feats.filter(feat=>feat.trim().toLowerCase()!=='dark bargain')};
    repairs.push('Removed the unfinished Dark Bargain feat choice from the older Ferocitus import.');
  }
  // Older saved imports retained the equipment names but predate structured
  // weapon attacks. Enrich only this known public character and only exact
  // weapon names, leaving user-edited and already-structured items untouched.
  if(character.id==='ddb-152187683'){
    let enriched=0;
    const items=migrated.items.map(item=>{
      const attack=FEROCITUS_WEAPONS[item.name.trim().toLowerCase()];
      if(!attack||item.attack)return item;
      enriched+=1;
      return {...item,attack};
    });
    if(enriched){migrated={...migrated,items};repairs.push(`Restored ${enriched} structured equipped weapon action${enriched===1?'':'s'} from the linked public sheet.`);}
  }
  if(!repairs.length)return {character,repairs};
  return {
    character:migrated,
    repairs,
  };
}
