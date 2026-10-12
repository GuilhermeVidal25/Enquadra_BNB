async function casesAPI(request,env){
const owner=request.headers.get('oai-authenticated-user-id');if(!owner)return json({error:'Entre com sua conta para acessar os casos.'},401);if(!env.BUCKET)return json({error:'O armazenamento de documentos ainda não está disponível.'},503);
const url=new URL(request.url),segments=url.pathname.split('/').filter(Boolean),id=segments[2];const prefix='cases/'+encodeURIComponent(owner)+'/';let key=id?prefix+id+'/meta.json':null;
if(!['GET','HEAD'].includes(request.method)){if(request.headers.get('origin')!==url.origin)return json({error:'Origem não permitida.'},403);}
if(request.method==='GET'&&!id){let cursor,items=[];do{const page=await env.BUCKET.list({prefix,cursor});for(const o of page.objects.filter(o=>o.key.endsWith('/meta.json'))){const obj=await env.BUCKET.get(o.key);if(obj){let data=await obj.json();const shared=await env.BUCKET.get('team-cases/'+data.id+'/meta.json');if(shared)data=await shared.json();items.push({id:data.id,code:data.code,title:data.title,createdAt:data.createdAt,updatedAt:data.updatedAt,revision:data.revision,files:data.documents.length,shared:!!data.shared,reviewCount:reviewSummary(data).count,check:data.check?{blocked:data.check.blocked,coverage:data.check.coverage,findings:data.check.findings.length}:null})}}cursor=page.truncated?page.cursor:undefined}while(cursor);return json({cases:items.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))})}
if(request.method==='POST'&&!id){let data;try{data=await request.json()}catch{return json({error:'Caso inválido.'},400)}if(typeof data.title!=='string'||!data.title.trim()||data.title.length>200||typeof data.code!=='string'||!/^[-A-Z0-9_]{1,40}$/.test(data.code))return json({error:'Informe um título e código válido.'},400);const created={id:crypto.randomUUID(),code:data.code,title:data.title.trim(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),revision:1,documents:[],events:[{action:'Caso criado',at:new Date().toISOString(),actor:owner}],check:null};await env.BUCKET.put(prefix+created.id+'/meta.json',JSON.stringify(created),{httpMetadata:{contentType:'application/json'}});return json(created,201)}
if(!id||!/^[0-9a-f-]{36}$/.test(id))return json({error:'Caso inválido.'},400);
let stored=await env.BUCKET.get('team-cases/'+id+'/meta.json');if(stored||corpusCases[id])key='team-cases/'+id+'/meta.json';else stored=await env.BUCKET.get(key);
const project=stored?await stored.json():seedCase(id);if(!project)return json({error:'Caso não encontrado.'},404);normalizeReviews(project);
const currentUser=analystIdentity(request);const writeCondition=stored?{etagMatches:stored.etag}:new Headers({'If-None-Match':'*'});
const filePrefix='files/'+encodeURIComponent(project.fileOwner||owner)+'/'+id+'/';
const caseReply=(p,status=200)=>json({...p,currentUser,reviewCount:reviewSummary(p).count,divergent:reviewSummary(p).divergent},status);
if(request.method==='POST'&&segments[3]==='share'){
 let body;try{body=await request.json()}catch{return json({error:'Solicitação inválida.'},400)}
 if(body.revision!==project.revision)return json({error:'O caso mudou. Atualize antes de disponibilizar à equipe.'},409);
 if(project.shared)return caseReply(project);
 project.shared=true;project.fileOwner=owner;project.revision++;project.updatedAt=new Date().toISOString();project.events.push({action:'Caso disponibilizado aos analistas autorizados neste Site',actor:owner,at:project.updatedAt});
 const put=await env.BUCKET.put('team-cases/'+id+'/meta.json',JSON.stringify(project),{onlyIf:new Headers({'If-None-Match':'*'}),httpMetadata:{contentType:'application/json'}});if(!put)return json({error:'O caso já foi disponibilizado. Atualize a página.'},409);return caseReply(project);
} 
if(request.method==='GET'&&segments.length===3)return caseReply(project);
const isCurrent=d=>!['superseded','removed'].includes(d.status);
const validReason=value=>typeof value==='string'&&value.trim().length>=5&&value.length<=2000;
async function saveCorrection(action,detail={}){
 project.check=Precheck.check(project.documents,project.code);
 invalidateCaseReviews(project,action);
 project.revision++;project.updatedAt=new Date().toISOString();
 project.events.push({action,...detail,at:project.updatedAt,actor:owner});
 const saved=await env.BUCKET.put(key,JSON.stringify(project),{onlyIf:writeCondition,httpMetadata:{contentType:'application/json'}});
 return saved?caseReply(project):json({error:'Outro analista alterou o caso. Atualize antes de tentar novamente.'},409);
}
async function correctionBody(){try{return await request.json()}catch{return null}}
if(request.method==='PATCH'&&segments.length===3){
 const body=await correctionBody();if(!body)return json({error:'Correção inválida.'},400);
 if(body.revision!==project.revision)return json({error:'O caso mudou. Atualize para corrigir os dados.'},409);
 if(!validReason(body.reason)||typeof body.title!=='string'||!body.title.trim()||body.title.length>200||typeof body.code!=='string'||!/^[-A-Z0-9_]{1,40}$/.test(body.code))return json({error:'Informe código, título e motivo da correção (mínimo de 5 caracteres).'},400);
 const before={code:project.code,title:project.title};const after={code:body.code,title:body.title.trim()};
 if(before.code===after.code&&before.title===after.title)return json({error:'Nenhum dado do caso foi alterado.'},400);
 Object.assign(project,after);return saveCorrection('Dados do caso corrigidos',{reason:body.reason.trim(),before,after});
}
if(request.method==='POST'&&segments[3]==='documents'&&segments.length===6){
 const doc=project.documents.find(d=>d.id===segments[4]);if(!doc)return json({error:'Documento não encontrado.'},404);
 const action=segments[5],body=await correctionBody();if(!body)return json({error:'Correção inválida.'},400);
 if(body.revision!==project.revision)return json({error:'O caso mudou. Atualize para corrigir o documento.'},409);
 if(!validReason(body.reason))return json({error:'Explique o motivo da correção (mínimo de 5 caracteres).'},400);
 if(action==='remove'){
  if(!isCurrent(doc))return json({error:'Este documento já foi removido ou substituído.'},409);
  const previous=doc.status;doc.removedFromStatus=previous;doc.status='removed';doc.removedAt=new Date().toISOString();doc.removalReason=body.reason.trim();
  return saveCorrection('Documento removido da análise',{document:doc.name,documentId:doc.id,hash:doc.hash,previousStatus:previous,status:'removed',reason:body.reason.trim()});
 }
 if(action==='restore'){
  if(doc.status!=='removed')return json({error:'Este documento não está removido.'},409);
  const previous=doc.removedFromStatus;
  if(!['excluded','duplicate'].includes(previous)&&project.documents.some(d=>d.id!==doc.id&&!['excluded','duplicate','superseded','removed'].includes(d.status)&&Precheck.base(d.name)===Precheck.base(doc.name)))return json({error:'Já existe uma versão atual deste documento. Remova a versão atual antes de restaurar esta.'},409);
  if(previous==='duplicate'&&!project.documents.some(d=>d.id===doc.duplicateOf&&!['removed','superseded','duplicate','excluded'].includes(d.status)))return json({error:'Restaure o documento original desta cópia primeiro.'},409);
  doc.status=previous;delete doc.removedFromStatus;delete doc.removedAt;delete doc.removalReason;
  return saveCorrection('Documento restaurado para análise',{document:doc.name,documentId:doc.id,hash:doc.hash,status:doc.status,reason:body.reason.trim()});
 }
 if(action==='edit'){
  if(!isCurrent(doc)||['excluded','duplicate'].includes(doc.status)||doc.originalStored===false)return json({error:'Edite apenas a versão atual de um arquivo recebido.'},409);
  const ext=Precheck.base(doc.name).split('.').pop();
  if(!['csv','json','md','txt'].includes(ext))return json({error:'Para PDF ou Excel, use Substituir arquivo.'},400);
  if(typeof body.text!=='string'||!body.text.trim()||body.text.length>2*1024*1024)return json({error:'Informe conteúdo de até 2 MB.'},400);
  if(body.text===doc.text)return json({error:'O conteúdo não foi alterado.'},400);
  const replacement={id:crypto.randomUUID(),name:doc.name,kind:ext,status:'read',text:body.text,error:null,extraction:'server-text-editor-v1',supersedes:doc.id,actor:owner,uploadedAt:new Date().toISOString(),editReason:body.reason.trim()};
  try{if(ext==='csv')replacement.tables=[Precheck.parseCSV(body.text)];if(ext==='json')replacement.json=JSON.parse(body.text)}catch(e){return json({error:'Conteúdo inválido: '+e.message+'. A versão anterior foi preservada.'},400)}
  if(JSON.stringify(replacement).length>3*1024*1024)return json({error:'A extração ultrapassa o limite de 3 MB. Envie uma versão menor.'},413);
  const bytes=new TextEncoder().encode(body.text);replacement.bytes=bytes.byteLength;replacement.hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(project.documents.some(d=>d.id!==doc.id&&!['excluded','duplicate','superseded','removed'].includes(d.status)&&d.hash===replacement.hash))return json({error:'Este conteúdo já pertence a outro documento atual. Confira as versões antes de substituir.'},409);
  await env.BUCKET.put(filePrefix+replacement.id,bytes,{httpMetadata:{contentType:'application/octet-stream'}});
  doc.previousStatus=doc.status;doc.status='superseded';doc.supersededBy=replacement.id;project.documents.push(replacement);
  return saveCorrection('Dados do documento corrigidos; nova versão criada',{document:doc.name,documentId:replacement.id,previousDocumentId:doc.id,previousHash:doc.hash,hash:replacement.hash,reason:body.reason.trim()});
 }
 return json({error:'Correção não permitida.'},405);
}

if(request.method==='GET'&&segments[3]==='files'){const doc=project.documents.find(d=>d.id===segments[4]);if(!doc)return json({error:'Documento não encontrado.'},404);const obj=await env.BUCKET.get(filePrefix+doc.id);const original=doc.seedDocument?originalCorpusBytes(doc.id):null;if(!obj&&!original)return json({error:'Arquivo original indisponível.'},404);const content=obj?.body||original;return new Response(content,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(doc.name.split('/').pop()),'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}})}
if(request.method==='POST'&&segments[3]==='documents'&&segments.length===4){
 if(Number(request.headers.get('content-length')||0)>16*1024*1024)return json({error:'Arquivo excede o limite de 10 MB.'},413);
 let form,analysis,file;try{form=await request.formData();file=form.get('file');const text=form.get('analysis');if(typeof text!=='string'||text.length>3*1024*1024)throw Error();analysis=JSON.parse(text)}catch{return json({error:'Envio inválido ou extração excede o limite de 3 MB.'},400)}
 if(!file||typeof file.arrayBuffer!=='function'||file.size>10*1024*1024)return json({error:'Selecione um arquivo de até 10 MB.'},413);
 if(Number(form.get('revision'))!==project.revision)return json({error:'O caso mudou durante o envio. Atualize e tente novamente.'},409);
 if(typeof analysis.name!=='string'||analysis.name.length>500||!['read','partial','unreadable','excluded'].includes(analysis.status)||analysis.name.split(/[\\/]/).includes('..'))return json({error:'Metadados inválidos.'},400);
 if(analysis.text&&typeof analysis.text!=='string'||analysis.tables&&(!Array.isArray(analysis.tables)||analysis.tables.some(t=>!Array.isArray(t.columns)||!Array.isArray(t.rows)||t.rows.some(r=>!r||typeof r!=='object'))))return json({error:'Extração inválida.'},400);
 const replaces=form.get('replaces'),reason=form.get('reason');let target=null;
 if(replaces){target=project.documents.find(d=>d.id===replaces);if(!target||!isCurrent(target)||['excluded','duplicate'].includes(target.status))return json({error:'Selecione uma versão atual para substituir.'},409);if(!validReason(reason))return json({error:'Informe o motivo da substituição.'},400);if(Precheck.base(target.name).split('.').pop()!==Precheck.base(analysis.name).split('.').pop())return json({error:'Use o mesmo formato do documento original.'},400);if(!['read','partial','unreadable'].includes(analysis.status))return json({error:'O arquivo de substituição deve ser um documento de análise.'},400);analysis.name=target.name;}
 const bytes=await file.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes),hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
 const duplicate=project.documents.find(d=>d.hash===hash&&!['excluded','duplicate','superseded','removed'].includes(d.status));const doc={...analysis,id:crypto.randomUUID(),hash,bytes:file.size,uploadedAt:new Date().toISOString(),actor:owner};
 if(target&&duplicate)return json({error:duplicate.id===target.id?'O arquivo é idêntico à versão atual.':'Este arquivo já existe como outro documento atual.'},409);
 if(target){target.previousStatus=target.status;target.status='superseded';target.supersededBy=doc.id;doc.supersedes=target.id;doc.editReason=reason.trim();doc.originalFilename=file.name;}
 else {
  if(duplicate&&doc.status!=='excluded'){doc.status='duplicate';doc.duplicateOf=duplicate.id;doc.text='';doc.tables=[];delete doc.json;doc.error=null;}
  if(!duplicate&&doc.status!=='excluded'){const prior=project.documents.filter(d=>!['excluded','duplicate','superseded','removed'].includes(d.status)&&(d.name===doc.name||!doc.name.includes('/')&&Precheck.base(d.name)===Precheck.base(doc.name)));if(prior.length===1){prior[0].previousStatus=prior[0].status;prior[0].status='superseded';prior[0].supersededBy=doc.id;doc.supersedes=prior[0].id;}}
 }
 await env.BUCKET.put(filePrefix+doc.id,bytes,{httpMetadata:{contentType:'application/octet-stream'}});
 project.documents.push(doc);project.check=Precheck.check(project.documents,project.code);project.revision++;project.updatedAt=new Date().toISOString();invalidateCaseReviews(project,'Pacote documental alterado');project.events.push({action:target?'Documento substituído; nova versão criada':'Documento recebido; checagem atualizada',document:doc.name,documentId:doc.id,previousDocumentId:target?.id,previousHash:target?.hash,hash:doc.hash,reason:target?reason.trim():undefined,status:doc.status,at:project.updatedAt,actor:owner});
 const put=await env.BUCKET.put(key,JSON.stringify(project),{onlyIf:writeCondition,httpMetadata:{contentType:'application/json'}});if(!put)return json({error:'Outro envio alterou o caso. Atualize e reenvie o arquivo.'},409);return caseReply(project,201);
}
if(request.method==='POST'&&segments[3]==='rejected'){let data;try{data=await request.json()}catch{return json({error:'Registro inválido.'},400)}if(data.revision!==project.revision)return json({error:'Atualize o caso antes de registrar a falha.'},409);if(typeof data.name!=='string'||typeof data.reason!=='string')return json({error:'Registro incompleto.'},400);project.documents.push({id:crypto.randomUUID(),name:data.name.slice(0,500),bytes:Number(data.size)||0,hash:'',status:'unreadable',error:data.reason.slice(0,2000),uploadedAt:new Date().toISOString(),actor:owner,originalStored:false});project.check=Precheck.check(project.documents,project.code);invalidateCaseReviews(project,'Pacote documental alterado');project.revision++;project.updatedAt=new Date().toISOString();project.events.push({action:'Arquivo não recebido; falha registrada',document:data.name,at:project.updatedAt,actor:owner});const put=await env.BUCKET.put(key,JSON.stringify(project),{onlyIf:writeCondition});if(!put)return json({error:'O caso mudou durante o registro.'},409);return caseReply(project)}
if(request.method==='POST'&&segments[3]==='import-event'){let data;try{data=await request.json()}catch{return json({error:'Registro inválido.'},400)}if(data.revision!==project.revision)return json({error:'Atualize o caso para registrar a importação.'},409);project.events.push({action:data.success?'Importação concluída':'Importação incompleta',document:String(data.detail||'').slice(0,8000),status:data.success?'concluída':'verificar arquivos não recebidos',at:new Date().toISOString(),actor:owner});project.revision++;project.updatedAt=new Date().toISOString();const put=await env.BUCKET.put(key,JSON.stringify(project),{onlyIf:writeCondition});if(!put)return json({error:'O caso mudou durante o registro.'},409);return caseReply(project)}
if(request.method==='POST'&&segments[3]==='check'){let body;try{body=await request.json()}catch{return json({error:'Requisição inválida.'},400)}if(body.revision!==project.revision)return json({error:'O caso mudou. Atualize antes de repetir a checagem.'},409);project.check=Precheck.check(project.documents,project.code);project.revision++;project.updatedAt=new Date().toISOString();project.events.push({action:'Checagem prévia reexecutada',at:project.updatedAt,actor:owner});const put=await env.BUCKET.put(key,JSON.stringify(project),{onlyIf:writeCondition});if(!put)return json({error:'O caso mudou durante a checagem.'},409);return caseReply(project)}
if(request.method==='POST'&&segments[3]==='review'){let body;try{body=await request.json()}catch{return json({error:'Revisão inválida.'},400)}if(body.revision!==project.revision)return json({error:'Documentos alterados. Atualize e revise novamente.'},409);const classes=['Elegível','Com ressalvas','Não elegível','Evidência insuficiente'];const states=['Sustentado','Não sustentado','Insuficiente','Contraditório'];if(!classes.includes(body.classification)||typeof body.conclusion!=='string'||body.conclusion.trim().length<20||!Array.isArray(body.criteria)||body.criteria.length!==5)return json({error:'Preencha os cinco critérios e fundamente a conclusão.'},400);if(body.criteria.some(c=>!states.includes(c.state)||typeof c.comment!=='string'||c.comment.trim().length<10||!project.documents.some(d=>d.id===c.documentId&&isCurrent(d)&&!['duplicate','excluded'].includes(d.status))&&c.documentId!=='_check'))return json({error:'Cada critério precisa de estado, justificativa e origem.'},400);if(body.criteria.some(c=>c.state==='Sustentado'&&(c.documentId==='_check'||project.documents.find(d=>d.id===c.documentId)?.status!=='read')))return json({error:'Um critério sustentado exige referência a um documento lido; presença ou checagem estrutural não bastam.'},400);if(project.check?.blocked&&['Elegível','Com ressalvas'].includes(body.classification))return json({error:'Resolva os bloqueios de leitura e vínculos antes de concluir elegibilidade.'},400);if(!project.documents.some(d=>d.status==='read'))return json({error:'Receba ao menos um documento legível antes do parecer.'},400);const previous=project.reviews.find(r=>r.actor===owner);if(previous)project.reviewHistory.push({...previous,supersededAt:new Date().toISOString()});project.reviews=project.reviews.filter(r=>r.actor!==owner);project.review={criteria:body.criteria.map(c=>({state:c.state,comment:c.comment.trim().slice(0,6000),documentId:c.documentId,locator:String(c.locator||'').slice(0,300)})),classification:body.classification,conclusion:body.conclusion.trim().slice(0,10000),actor:owner,analystName:currentUser.name,at:new Date().toISOString(),documentRevision:project.revision,documentVersion:project.documentVersion};project.reviews.push(project.review);project.revision++;project.updatedAt=new Date().toISOString();project.events.push({action:'Avaliação individual e parecer técnico preliminar registrados',analystName:currentUser.name,documentVersion:project.documentVersion,classification:body.classification,at:project.updatedAt,actor:owner});const put=await env.BUCKET.put(key,JSON.stringify(project),{onlyIf:writeCondition});if(!put)return json({error:'O caso mudou durante a revisão.'},409);return caseReply(project)}
return json({error:'Operação não permitida.'},405);
}
