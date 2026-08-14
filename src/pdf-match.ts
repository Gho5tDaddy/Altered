export interface PdfTextItem {str?:string;hasEOL?:boolean}

const normalize=(value:string)=>value.replace(/\s+/g,' ').trim();
const escapeRegExp=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

function readableLines(items:PdfTextItem[]){
  const lines:string[]=[];let current='';
  for(const item of items){const value=normalize(item.str??'');if(value)current=normalize(`${current} ${value}`);if(item.hasEOL&&current){lines.push(current);current='';}}
  if(current)lines.push(current);return lines;
}

function ruleEvidence(value:string,kind:string){
  const lower=value.toLowerCase();
  if(value.split(/\s+/).length<24)return false;
  const letters=value.replace(/[^A-Za-z]/g,'');if((value.match(/[A-Z]/g)?.length??0)/Math.max(1,letters.length)>.72)return false;
  if(kind.toLowerCase()==='spell'){
    const fields=[/\bcasting time\b/,/\brange\b/,/\bcomponents?\b/,/\bduration\b/,/\bat higher levels?\b/,/\bsaving throw\b/].filter(pattern=>pattern.test(lower)).length;
    if(fields<2)return false;
  }
  const signals=[
    /\byou (?:can|gain|have|make|must|may|use|add|choose|become|are)\b/,
    /\bwhen (?:you|a creature|the target)|\bwhenever\b|\bif (?:you|the target|a creature)\b/,
    /\baction\b|\bbonus action\b|\breaction\b|\battack\b/,
    /\bdamage\b|\bhit points?\b|\barmor class\b|\bspeed\b/,
    /\bsaving throw\b|\bability check\b|\badvantage\b|\bdisadvantage\b/,
    /\bproficiency\b|\bmodifier\b|\bdc \d+\b|\b\d+d\d+\b/,
    /\bonce per\b|\bshort rest\b|\blong rest\b|\bnumber of times\b/,
    /\bwithin \d+ feet\b|\bfor \d+ (?:rounds?|minutes?|hours?)\b|\buntil\b/
  ].filter(pattern=>pattern.test(lower)).length;
  return signals>=2;
}

export function findPdfRuleEntry(items:PdfTextItem[],name:string,kind:string){
  const lines=readableLines(items);const exact=new RegExp(`^(?:chapter\\s+\\d+\\s*[:—-]\\s*)?${escapeRegExp(name)}(?:\\s*[:—-].{0,42}|\\s+\\d{1,3})?$`,'i');
  for(let index=0;index<lines.length;index++){
    const heading=lines[index]!;if(!exact.test(heading))continue;
    const following=lines.slice(index+1,index+15).join(' ');const sameLine=normalize(heading.replace(new RegExp(`^${escapeRegExp(name)}\\s*[:—-]?\\s*`,'i'),''));
    const candidate=normalize(`${sameLine} ${following}`).slice(0,1100);if(!ruleEvidence(candidate,kind))continue;
    const sentences=candidate.match(/[^.!?]{20,260}[.!?]/g)?.slice(0,3).join(' ')??candidate.slice(0,500);
    return normalize(sentences).slice(0,500);
  }
  return '';
}
