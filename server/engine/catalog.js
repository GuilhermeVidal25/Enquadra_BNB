function analystIdentity(request){
 const id=request.headers.get('oai-authenticated-user-id');let name=request.headers.get('oai-authenticated-user-full-name');
 if(name&&request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8')try{name=decodeURIComponent(name)}catch{name=null}
 return {id,name:name||request.headers.get('oai-authenticated-user-email')||'Analista '+String(id||'').slice(0,8)};
}
function normalizeReviews(project){
 project.documentVersion??=1;
 project.reviews??=project.review?[{...project.review,documentVersion:project.documentVersion,analystName:project.review.actor}]:[];
 project.reviewHistory??=[];
 return project;
}
function invalidateCaseReviews(project,reason){
 normalizeReviews(project);
 for(const review of project.reviews)project.reviewHistory.push({...review,invalidatedAt:new Date().toISOString(),invalidationReason:reason});
 project.reviews=[];project.review=null;project.documentVersion++;
}
function reviewSummary(project){
 normalizeReviews(project);const reviews=project.reviews.filter(r=>r.documentVersion===project.documentVersion);
 const signatures=reviews.map(r=>JSON.stringify([r.classification,...r.criteria.map(c=>c.state)]));
 return {count:new Set(reviews.map(r=>r.actor)).size,divergent:new Set(signatures).size>1,reviews:reviews.map(r=>({actor:r.actor,analystName:r.analystName||r.actor,at:r.at,classification:r.classification,documentVersion:r.documentVersion}))};
}
function seedCase(id){
 const raw=corpusCases[id];if(!raw)return null;const p=JSON.parse(raw);
 p.documents.forEach(d=>{delete d.original});p.shared=true;p.catalogCase=true;p.fileOwner='corpus';p.createdAt=p.seedPreparedAt;p.updatedAt=p.createdAt;p.revision=1;p.documentVersion=1;p.reviews=[];p.review=null;p.reviewHistory=[];
 p.events=[{action:'Pacote original do evento incorporado; checagem estrutural e numérica executada',actor:'Sistema',at:p.createdAt,document:p.seedVersion}];return p;
}
async function analyzedCasesAPI(request,env){
 const viewer=analystIdentity(request);if(!viewer.id)return json({error:'Entre com sua conta para acessar os casos.'},401);if(!env.BUCKET)return json({error:'Armazenamento indisponível.'},503);
 if(request.method!=='GET')return json({error:'Operação não permitida.'},405);
 const cases=await Promise.all(corpusIndex.map(async seed=>{const stored=await env.BUCKET.get('team-cases/'+seed.id+'/meta.json');const p=stored?await stored.json():seedCase(seed.id);return catalogRow(p)}));
 let cursor;do{const page=await env.BUCKET.list({prefix:'team-cases/',cursor});for(const item of page.objects){if(!item.key.endsWith('/meta.json'))continue;const stored=await env.BUCKET.get(item.key);if(!stored)continue;const p=await stored.json();if(!corpusCases[p.id])cases.push(catalogRow(p))}cursor=page.truncated?page.cursor:undefined}while(cursor);
 // Personal cases become visible in the same collection, retaining their access scope.
 cursor=undefined;do{const page=await env.BUCKET.list({prefix:'cases/'+encodeURIComponent(viewer.id)+'/',cursor});for(const item of page.objects){if(!item.key.endsWith('/meta.json'))continue;const stored=await env.BUCKET.get(item.key);if(!stored)continue;const p=await stored.json();if(!cases.some(c=>c.id===p.id))cases.push(catalogRow(p))}cursor=page.truncated?page.cursor:undefined}while(cursor);
 return json({cases,currentUser:viewer,sourceCases:40});
}
function catalogRow(p){const summary=reviewSummary(p);return {id:p.id,code:p.code,title:p.title,shared:!!p.shared,catalogCase:!!p.catalogCase,sourceDataset:p.sourceDataset,revision:p.revision,documentVersion:p.documentVersion,files:p.documents.length,check:p.check?{blocked:p.check.blocked,coverage:p.check.coverage,findings:p.check.findings.length,results:p.check.calculations.length}:null,reviewCount:summary.count,divergent:summary.divergent,reviews:summary.reviews,previousReviews:p.reviewHistory.length,updatedAt:p.updatedAt}}

function originalCorpusBytes(docId){const refs=corpusOriginals[docId];if(!refs)return null;const parts=refs.map(index=>Uint8Array.from(atob(corpusChunks[index]),c=>c.charCodeAt(0)));const result=new Uint8Array(parts.reduce((sum,p)=>sum+p.length,0));let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;}
