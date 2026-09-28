const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const path=require('path');
const fs=require('fs');
const {QUESTIONS}=require('./questionBank');

const app=express();
const server=http.createServer(app);
const io=new Server(server);
const PORT=process.env.PORT||3000;
const DATA_DIR=path.join(__dirname,'data');
const CUSTOM_FILE=path.join(DATA_DIR,'custom_questions.json');
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR,{recursive:true});
if(!fs.existsSync(CUSTOM_FILE)) fs.writeFileSync(CUSTOM_FILE,'[]','utf8');

app.use(express.json({limit:'2mb'}));
app.use(express.static(path.join(__dirname,'public')));

const safeReadCustom=()=>{try{return JSON.parse(fs.readFileSync(CUSTOM_FILE,'utf8'))||[]}catch{return[]}};
const saveCustom=(arr)=>fs.writeFileSync(CUSTOM_FILE,JSON.stringify(arr,null,2),'utf8');
const allQuestions=()=>[...QUESTIONS,...safeReadCustom()];
const TOPICS=['Ciencia','Método científico','Casos aplicados','Búsqueda académica','Ética y APA 7','Simulacro','Personalizadas'];
const AVATARS=['🦊','🐼','🐯','🦁','🐸','🐙','🦉','🐨','🐧','🦄','🐵','🐬','🦋','🐢','🦖','🚀','⚡','🌟','🎯','🧠'];

app.get('/api/meta',(req,res)=>{
 const custom=safeReadCustom();
 const all=allQuestions();
 const stats={}; all.forEach(q=>stats[q.topic]=(stats[q.topic]||0)+1);
 res.json({total:all.length,builtIn:QUESTIONS.length,custom:custom.length,topics:TOPICS,stats,avatars:AVATARS});
});
app.get('/api/questions',(req,res)=>{
 const {topic,difficulty,customOnly}=req.query;
 let arr=customOnly==='1'?safeReadCustom():allQuestions();
 if(topic) arr=arr.filter(q=>q.topic===topic);
 if(difficulty) arr=arr.filter(q=>q.difficulty===difficulty);
 res.json(arr);
});
app.post('/api/questions',(req,res)=>{
 const {topic='Personalizadas',difficulty='Media',q,a,correct,explain=''}=req.body||{};
 if(!q||!Array.isArray(a)||a.length!==4||a.some(x=>!String(x).trim())||![0,1,2,3].includes(Number(correct))) return res.status(400).json({error:'Completa pregunta, cuatro alternativas y respuesta correcta.'});
 const arr=safeReadCustom();
 const item={id:`custom_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,topic:topic||'Personalizadas',difficulty:['Fácil','Media','Difícil'].includes(difficulty)?difficulty:'Media',q:String(q).trim(),a:a.map(x=>String(x).trim()),correct:Number(correct),explain:String(explain||'').trim()||'Pregunta personalizada.'};
 arr.push(item); saveCustom(arr); res.json(item);
});
app.delete('/api/questions/:id',(req,res)=>{
 const before=safeReadCustom(); const after=before.filter(x=>x.id!==req.params.id); saveCustom(after); res.json({ok:true,deleted:before.length-after.length});
});
app.get('/api/questions-export',(req,res)=>{res.setHeader('Content-Disposition','attachment; filename="preguntas_personalizadas.json"');res.json(safeReadCustom())});

const rooms=new Map();
function makeCode(){let c;do{c=String(Math.floor(100000+Math.random()*900000))}while(rooms.has(c));return c}
function shuffle(arr){return [...arr].sort(()=>Math.random()-0.5)}
function normalizedTopics(t){return Array.isArray(t)&&t.length?t.filter(Boolean):['Ciencia','Método científico','Casos aplicados','Búsqueda académica','Ética y APA 7']}
function poolFor(opts={}){
 let pool=allQuestions();
 const topics=normalizedTopics(opts.topics);
 if(!topics.includes('Todos')) pool=pool.filter(x=>topics.includes(x.topic)||(topics.includes('Personalizadas')&&x.id?.startsWith('custom_')));
 if(opts.difficulty&&opts.difficulty!=='Todas') pool=pool.filter(x=>x.difficulty===opts.difficulty);
 return pool;
}
function chooseQuestions(opts={}){
 if(opts.mode==='simulacro') return buildSimulacro();
 const pool=poolFor(opts);
 return shuffle(pool).slice(0,Math.min(Number(opts.count)||15,pool.length));
}
function pick(pool,predicate,count){const candidates=shuffle(pool.filter(predicate));return candidates.slice(0,count)}
function buildSimulacro(){
 const all=allQuestions();
 // 20 points, mirroring the real exam structure.
 const p1=[...pick(all,q=>['Ciencia','Método científico','Búsqueda académica','Ética y APA 7'].includes(q.topic),8),...pick(all,q=>['Búsqueda académica','Ética y APA 7','Ciencia'].includes(q.topic),4)].map((q,i)=>({...q,examPart:'I',points:0.5,format:i<8?'Opción múltiple':'Verdadero/Falso conceptual'}));
 const p2=pick(all,q=>q.topic==='Método científico'||q.topic==='Casos aplicados'||(q.topic==='Simulacro'&&q.q.includes('Parte II')),6).map((q,i)=>({...q,examPart:'II',points:[0.5,1,1,1,0.75,0.75][i]||0.75,format:'Caso: método científico'}));
 const p3=pick(all,q=>q.topic==='Búsqueda académica'||(q.topic==='Simulacro'&&q.q.includes('Parte III')),9).map((q,i)=>({...q,examPart:'III',points:[0.25,0.25,0.25,0.25,0.25,0.25,1.5,1.5,0.5][i]||0.5,format:'Caso: estrategia de búsqueda'}));
 const p4=pick(all,q=>q.topic==='Ética y APA 7'||(q.topic==='Simulacro'&&q.q.includes('Parte IV')),5).map((q,i)=>({...q,examPart:'IV',points:[1,0.75,0.5,0.5,1.25][i]||0.5,format:'APA 7'}));
 return [...p1,...p2,...p3,...p4];
}
function publicRoom(room){return{code:room.code,state:room.state,mode:room.mode,players:[...room.players.values()].map(p=>({id:p.id,name:p.name,avatar:p.avatar,score:p.score,examScore:p.examScore||0})),qIndex:room.qIndex,total:room.questions.length,settings:room.settings}}
function sendLobby(room){io.to(room.code).emit('lobby:update',publicRoom(room))}

io.on('connection',socket=>{
 socket.on('host:create',(opts={})=>{
  const code=makeCode(); const settings={count:Number(opts.count)||15,difficulty:opts.difficulty||'Todas',topics:normalizedTopics(opts.topics),duration:Number(opts.duration)||20};
  const mode=opts.mode==='simulacro'?'simulacro':'live';
  const questions=chooseQuestions({...settings,mode});
  if(!questions.length) return socket.emit('error:msg','No hay preguntas con esos filtros.');
  const room={code,hostId:socket.id,hostName:(opts.name||'Docente').slice(0,30),mode,settings,state:'lobby',players:new Map(),questions,qIndex:-1,answers:new Map(),questionStartedAt:0,timer:null,countdownTimer:null};
  rooms.set(code,room);socket.join(code);socket.data.room=code;socket.data.role='host';socket.emit('host:created',{code,total:questions.length,mode});sendLobby(room);
 });
 socket.on('player:join',({code,name,avatar}={})=>{
  const room=rooms.get(String(code));if(!room)return socket.emit('error:msg','Sala no encontrada.');if(room.state!=='lobby')return socket.emit('error:msg','La partida ya empezó.');
  name=String(name||'Jugador').trim().slice(0,24);avatar=AVATARS.includes(avatar)?avatar:AVATARS[Math.floor(Math.random()*AVATARS.length)];
  room.players.set(socket.id,{id:socket.id,name,avatar,score:0,examScore:0,streak:0,last:null,correctCount:0,answeredCount:0});socket.join(room.code);socket.data.room=room.code;socket.data.role='player';socket.emit('player:joined',{code:room.code,name,avatar,mode:room.mode});sendLobby(room);
 });
 socket.on('host:start',()=>{const room=rooms.get(socket.data.room);if(!room||room.hostId!==socket.id)return;room.state='playing';room.qIndex=-1;startNext(room)});
 socket.on('host:next',()=>{const room=rooms.get(socket.data.room);if(!room||room.hostId!==socket.id)return;startNext(room)});
 socket.on('host:endQuestion',()=>{const room=rooms.get(socket.data.room);if(!room||room.hostId!==socket.id||room.state!=='question')return;clearTimeout(room.timer);reveal(room)});
 socket.on('player:answer',({choice}={})=>{
  const room=rooms.get(socket.data.room);if(!room||room.state!=='question'||room.answers.has(socket.id))return;const p=room.players.get(socket.id);if(!p)return;
  const question=room.questions[room.qIndex];const elapsed=Date.now()-room.questionStartedAt;const correct=Number(choice)===question.correct;let gain=0;
  p.answeredCount=(p.answeredCount||0)+1;
  if(correct){p.correctCount=(p.correctCount||0)+1;p.streak++;gain=Math.max(450,Math.round(1000-elapsed/(room.settings.duration*35)))+Math.min(300,p.streak*45);p.score+=gain;if(room.mode==='simulacro')p.examScore+=(question.points||0)}else p.streak=0;
  p.last={choice:Number(choice),correct,gain};room.answers.set(socket.id,p.last);socket.emit('answer:ack',{correct,gain,examPoints:correct?(question.points||0):0});io.to(room.hostId).emit('host:progress',{answered:room.answers.size,total:room.players.size});
  if(room.players.size>0&&room.answers.size>=room.players.size){clearTimeout(room.timer);room.timer=setTimeout(()=>reveal(room),650)}
 });
 socket.on('disconnect',()=>{const room=rooms.get(socket.data.room);if(!room)return;if(socket.id===room.hostId){io.to(room.code).emit('room:closed');clearTimeout(room.timer);clearTimeout(room.countdownTimer);rooms.delete(room.code)}else{room.players.delete(socket.id);sendLobby(room)}});
});

function startNext(room){
 clearTimeout(room.timer);clearTimeout(room.countdownTimer);room.qIndex++;
 if(room.qIndex>=room.questions.length)return finish(room);
 room.answers.clear();room.state='countdown';
 const question=room.questions[room.qIndex];io.to(room.code).emit('countdown',{value:3,index:room.qIndex+1,total:room.questions.length,examPart:question.examPart||null});
 room.countdownTimer=setTimeout(()=>sendQuestion(room),3000);
}
function sendQuestion(room){
 if(!rooms.has(room.code))return;room.state='question';room.questionStartedAt=Date.now();const x=room.questions[room.qIndex];
 io.to(room.code).emit('question',{index:room.qIndex+1,total:room.questions.length,topic:x.topic,difficulty:x.difficulty,q:x.q,a:x.a,duration:room.mode==='simulacro'?Math.max(25,room.settings.duration):room.settings.duration,examPart:x.examPart||null,points:x.points||null,format:x.format||null});
 room.timer=setTimeout(()=>reveal(room),(room.mode==='simulacro'?Math.max(25,room.settings.duration):room.settings.duration)*1000);
}
function reveal(room){
 if(room.state!=='question')return;
 room.state='reveal';
 const x=room.questions[room.qIndex];
 const distribution=[0,0,0,0];
 for(const ans of room.answers.values()){
  if(Number.isInteger(ans.choice)&&ans.choice>=0&&ans.choice<4) distribution[ans.choice]++;
 }
 const totalPlayers=room.players.size;
 const answered=room.answers.size;
 const unanswered=Math.max(0,totalPlayers-answered);
 const correctResponses=distribution[x.correct]||0;
 const ranking=[...room.players.values()]
  .sort((a,b)=>room.mode==='simulacro'?(b.examScore-a.examScore||b.score-a.score):(b.score-a.score))
  .map((p,i)=>({rank:i+1,name:p.name,avatar:p.avatar,score:p.score,examScore:Number((p.examScore||0).toFixed(2)),correct:p.last?.correct??false,correctCount:p.correctCount||0,answeredCount:p.answeredCount||0}));
 io.to(room.code).emit('reveal',{correct:x.correct,answers:x.a,explain:x.explain,ranking,examPart:x.examPart||null,points:x.points||null,distribution,totalPlayers,answered,unanswered,correctResponses});
}
function finish(room){
 room.state='finished';
 const totalQuestions=room.questions.length;
 const ranking=[...room.players.values()]
  .sort((a,b)=>room.mode==='simulacro'?(b.examScore-a.examScore||b.score-a.score):(b.score-a.score))
  .map((p,i)=>({
   rank:i+1,name:p.name,avatar:p.avatar,score:p.score,examScore:Number((p.examScore||0).toFixed(2)),
   correctCount:p.correctCount||0,answeredCount:p.answeredCount||0,
   incorrectCount:Math.max(0,(p.answeredCount||0)-(p.correctCount||0)),
   unansweredCount:Math.max(0,totalQuestions-(p.answeredCount||0)),
   accuracy:totalQuestions?Math.round(((p.correctCount||0)/totalQuestions)*100):0
  }));
 io.to(room.code).emit('game:finished',{ranking,mode:room.mode,maxExam:room.mode==='simulacro'?20:null,totalQuestions});
}

server.listen(PORT,'0.0.0.0',()=>console.log(`Método Quiz Live Pro: http://localhost:${PORT}`));
