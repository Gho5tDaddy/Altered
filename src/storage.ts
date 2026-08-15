import type {ContentPack,OwnedContentPack} from './types.js';

const DB_NAME='altered-local-v1';
const DB_VERSION=1;
const ART_STORE='art';
const SETTINGS_STORE='settings';
const PACK_STORE='content-packs';
const PACK_INDEX_KEY='__installed-pack-index__';
const MEMORY=new Map<string,unknown>();
const fallbackKey=(storeName:string,key:string)=>`altered:${storeName}:${key}`;

function requestValue<T>(request:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{request.addEventListener('success',()=>resolve(request.result),{once:true});request.addEventListener('error',()=>reject(request.error??new Error('IndexedDB request failed.')),{once:true});});}
function transactionDone(transaction:IDBTransaction):Promise<void>{return new Promise((resolve,reject)=>{transaction.addEventListener('complete',()=>resolve(),{once:true});transaction.addEventListener('abort',()=>reject(transaction.error??new Error('IndexedDB transaction aborted.')),{once:true});transaction.addEventListener('error',()=>reject(transaction.error??new Error('IndexedDB transaction failed.')),{once:true});});}
async function openDb():Promise<IDBDatabase>{
  if(!('indexedDB' in globalThis))throw new Error('IndexedDB is unavailable.');
  const request=indexedDB.open(DB_NAME,DB_VERSION);
  request.addEventListener('upgradeneeded',()=>{const db=request.result;if(!db.objectStoreNames.contains(ART_STORE))db.createObjectStore(ART_STORE);if(!db.objectStoreNames.contains(SETTINGS_STORE))db.createObjectStore(SETTINGS_STORE);if(!db.objectStoreNames.contains(PACK_STORE))db.createObjectStore(PACK_STORE);});
  return requestValue(request);
}
async function getValue<T>(storeName:string,key:string):Promise<T|undefined>{
  try{const db=await openDb();const transaction=db.transaction(storeName,'readonly');const value=await requestValue(transaction.objectStore(storeName).get(key)) as T|undefined;await transactionDone(transaction);db.close();if(value!==undefined)MEMORY.set(`${storeName}:${key}`,value);return value;}
  catch{
    const memory=MEMORY.get(`${storeName}:${key}`) as T|undefined;if(memory!==undefined)return memory;
    try{const raw=localStorage.getItem(fallbackKey(storeName,key));if(raw!==null){const value=JSON.parse(raw) as T;MEMORY.set(`${storeName}:${key}`,value);return value;}}catch{/* Browser storage is optional. */}
    return undefined;
  }
}
async function setValue(storeName:string,key:string,value:unknown):Promise<void>{
  MEMORY.set(`${storeName}:${key}`,value);
  try{const db=await openDb();const transaction=db.transaction(storeName,'readwrite');transaction.objectStore(storeName).put(value,key);await transactionDone(transaction);db.close();return;}catch{/* Use the smaller localStorage fallback when IndexedDB is unavailable. */}
  try{localStorage.setItem(fallbackKey(storeName,key),JSON.stringify(value));}catch{/* In-memory fallback keeps the current session usable. */}
}
async function deleteValue(storeName:string,key:string):Promise<void>{
  MEMORY.delete(`${storeName}:${key}`);
  try{const db=await openDb();const transaction=db.transaction(storeName,'readwrite');transaction.objectStore(storeName).delete(key);await transactionDone(transaction);db.close();}catch{/* Continue to fallback cleanup. */}
  try{localStorage.removeItem(fallbackKey(storeName,key));}catch{/* Nothing else to do. */}
}

const artKey=(characterId:string,targetId:string)=>`${characterId}:${targetId}`;
export function loadArtOverride(characterId:string,targetId:string):Promise<string|undefined>{return getValue<string>(ART_STORE,artKey(characterId,targetId))}
export function saveArtOverride(characterId:string,targetId:string,dataUrl:string):Promise<void>{if(!dataUrl.startsWith('data:image/'))throw new Error('Artwork must be an image data URL.');if(dataUrl.length>1_500_000)throw new Error('Optimized artwork exceeds the 1.5 MB storage limit.');return setValue(ART_STORE,artKey(characterId,targetId),dataUrl)}
export function removeArtOverride(characterId:string,targetId:string):Promise<void>{return deleteValue(ART_STORE,artKey(characterId,targetId))}

export async function loadBooleanSetting(key:string,defaultValue:boolean):Promise<boolean>{const value=await getValue<unknown>(SETTINGS_STORE,key);return typeof value==='boolean'?value:defaultValue}
export function saveBooleanSetting(key:string,value:boolean):Promise<void>{return setValue(SETTINGS_STORE,key,value)}
export function loadJsonSetting<T>(key:string):Promise<T|undefined>{return getValue<T>(SETTINGS_STORE,key)}
export function saveJsonSetting(key:string,value:unknown):Promise<void>{return setValue(SETTINGS_STORE,key,value)}
export function removeSetting(key:string):Promise<void>{return deleteValue(SETTINGS_STORE,key)}

export async function installExtensionPack(pack:OwnedContentPack):Promise<void>{
  const encoded=JSON.stringify(pack);if(encoded.length>2_000_000)throw new Error('Content pack exceeds the 2 MB local installation limit.');
  if(!pack.metadata||typeof pack.metadata.id!=='string'||!pack.metadata.id.trim())throw new Error('Content pack metadata is invalid.');
  await setValue(PACK_STORE,pack.metadata.id,pack);
  const records=await listExtensionPackRecords();
  const index=records.map(record=>record.id);
  if(!index.includes(pack.metadata.id))await setValue(PACK_STORE,PACK_INDEX_KEY,[...index,pack.metadata.id].sort());
}
export function loadExtensionPack(id:string):Promise<OwnedContentPack|undefined>{return getValue<OwnedContentPack>(PACK_STORE,id)}
export async function listExtensionPackRecords():Promise<Array<{id:string;pack:unknown}>>{
  const storedIndex=await getValue<unknown>(PACK_STORE,PACK_INDEX_KEY);
  const rawIndex=Array.isArray(storedIndex)?storedIndex:[];
  const index=[...new Set(rawIndex.filter((id):id is string=>typeof id==='string'&&id.length>0&&id!==PACK_INDEX_KEY))].slice(0,500);
  const records=await Promise.all(index.map(async id=>({id,pack:await getValue<unknown>(PACK_STORE,id)})));
  const present=records.filter(record=>record.pack!==undefined);
  if(!Array.isArray(storedIndex)||present.length!==rawIndex.length||present.some((record,position)=>record.id!==rawIndex[position]))await setValue(PACK_STORE,PACK_INDEX_KEY,present.map(record=>record.id));
  return present;
}
export async function listExtensionPacks():Promise<OwnedContentPack[]>{
  const records=await listExtensionPackRecords();
  return records.map(record=>record.pack).filter((pack):pack is OwnedContentPack=>Boolean(pack&&typeof pack==='object')).sort((a,b)=>String(a.metadata?.name??'').localeCompare(String(b.metadata?.name??'')));
}
export async function removeExtensionPack(id:string):Promise<void>{
  await deleteValue(PACK_STORE,id);
  await listExtensionPackRecords();
}

function imageElement(dataUrl:string):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{const image=new Image();image.decoding='async';image.addEventListener('load',()=>resolve(image),{once:true});image.addEventListener('error',()=>reject(new Error('The selected image could not be decoded.')),{once:true});image.src=dataUrl;});}
function readAsDataUrl(file:File):Promise<string>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.addEventListener('load',()=>typeof reader.result==='string'?resolve(reader.result):reject(new Error('The selected image could not be read.')),{once:true});reader.addEventListener('error',()=>reject(reader.error??new Error('The selected image could not be read.')),{once:true});reader.readAsDataURL(file);});}
function canvasBlob(canvas:HTMLCanvasElement,type:string,quality:number):Promise<Blob>{return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('The image could not be optimized.')),type,quality))}
function blobAsDataUrl(blob:Blob):Promise<string>{return readAsDataUrl(new File([blob],'portrait',{type:blob.type}))}

export interface PortraitFraming{fit:'fill'|'contain';zoom:number;x:number;y:number}
export async function optimizePortrait(file:File,framing:PortraitFraming={fit:'fill',zoom:100,x:0,y:0}):Promise<string>{
  if(!file.type.startsWith('image/'))throw new Error('Choose an image file.');
  if(file.size>12_000_000)throw new Error('Artwork must be smaller than 12 MB.');
  const raw=await readAsDataUrl(file);const image=await imageElement(raw);
  const width=512,height=683;const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');if(!context)throw new Error('Image processing is unavailable.');
  const base=(framing.fit==='contain'?Math.min:Math.max)(width/image.naturalWidth,height/image.naturalHeight);const scale=base*Math.max(1,Math.min(2.2,framing.zoom/100));const drawnWidth=image.naturalWidth*scale;const drawnHeight=image.naturalHeight*scale;
  const travelX=Math.abs(drawnWidth-width)/2,travelY=Math.abs(drawnHeight-height)/2;const x=(width-drawnWidth)/2+Math.max(-1,Math.min(1,framing.x/100))*travelX;const y=(height-drawnHeight)/2+Math.max(-1,Math.min(1,framing.y/100))*travelY;
  context.fillStyle='#080c10';context.fillRect(0,0,width,height);context.drawImage(image,x,y,drawnWidth,drawnHeight);
  let blob:Blob;try{blob=await canvasBlob(canvas,'image/webp',.86);}catch{blob=await canvasBlob(canvas,'image/jpeg',.88);}
  return blobAsDataUrl(blob);
}
