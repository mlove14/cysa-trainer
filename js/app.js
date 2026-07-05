let manifest = null,
  questions = [],
  sourceQuestions = [],
  current = 0,
  sessionScore = 0,
  answers = {},
  mode = 'practice',
  flagged = new Set(),
  favorites = new Set();

const STORE = 'cysaCoachR3Stats', LISTS = 'cysaCoachR3Lists';
const CASE_DETAILS = {
  'Case 001': {
    number: 'Case File 001',
    title: 'Payroll Phishing Campaign',
    difficulty: 'Hard',
    scenario: 'A payroll specialist opened a password-protected attachment from an external sender. Endpoint telemetry shows suspicious Microsoft Word and PowerShell behavior, but containment decisions must be based on validated impact.',
    context: 'Correlate endpoint, email, DNS, and proxy evidence to determine execution, scope, containment, and leadership communication.'
  },
  'Case 002': {
    number: 'Case File 002',
    title: 'VPN Authentication Bypass',
    difficulty: 'Hard',
    scenario: 'An internet-facing VPN appliance has an authentication bypass vulnerability with public exploit code and active exploitation reported by threat intelligence.',
    context: 'Prioritize remediation using exposure, exploitability, business criticality, detection evidence, containment options, and stakeholder communication.'
  },
  'Case 003': {
    number: 'Case File 003',
    title: 'Ransomware Outbreak',
    difficulty: 'Hard',
    scenario: 'A ransomware incident is unfolding across business systems, requiring careful incident response sequencing and evidence-based scoping.',
    context: 'Identify first actions, patient-zero evidence, eradication steps, executive messaging, and correct response sequence.'
  }
};

function getStats(){return JSON.parse(localStorage.getItem(STORE)||'{"answered":0,"correct":0,"lowConf":0,"domains":{},"topics":{},"mistakes":{}}')}
function getLists(){return JSON.parse(localStorage.getItem(LISTS)||'{"flagged":[],"incorrect":[],"favorites":[]}' )}
function saveLists(l){localStorage.setItem(LISTS,JSON.stringify(l))}
function saveStats(s){localStorage.setItem(STORE,JSON.stringify(s));updateDashboard()}
function pct(c,t){return t?Math.round(c/t*100):0}
function qkey(q=questions[current]){return `${packSelect.value}::${q.id}`}
function updateStats(rec){if(rec.statsSaved)return;let s=getStats();s.answered++;if(rec.correct)s.correct++;if(['guess','50','not selected'].includes(rec.confidence))s.lowConf++;for(let key of ['domain','topic','mistake']){let bucket=key==='domain'?s.domains:key==='topic'?s.topics:s.mistakes;let val=rec[key];if(!val)continue;if(!bucket[val])bucket[val]={answered:0,correct:0};bucket[val].answered++;if(rec.correct)bucket[val].correct++;}rec.statsSaved=true;saveStats(s)}
function weakest(obj){let name='Start Pack 1',min=101;Object.entries(obj).forEach(([k,v])=>{if(v.answered>=2){let p=pct(v.correct,v.answered);if(p<min){min=p;name=k}}});return name}
function updateDashboard(){let s=getStats();let acc=pct(s.correct,s.answered);let readiness=Math.min(99,Math.round(acc*.75+Math.min(s.answered,100)*.25));dashAnswered.textContent=s.answered;dashAccuracy.textContent=acc+'%';dashLowConf.textContent=s.lowConf;readinessScore.textContent=readiness+'%';readinessLabel.textContent=readiness>=85?'Strong readiness':readiness>=70?'Building readiness':'Start practicing';dashFocus.textContent=weakest(s.domains)}

async function init(){updateDashboard();manifest=await fetch('questions/manifest.json').then(r=>r.json());manifest.packs.forEach(p=>{let o=document.createElement('option');o.value=p.file;o.textContent=`${p.title} (${p.count})`;packSelect.appendChild(o)});let l=getLists();flagged=new Set(l.flagged);favorites=new Set(l.favorites);await loadSelectedPack()}
async function loadSelectedPack(){sourceQuestions=await fetch(packSelect.value).then(r=>r.json());prepareAttempt();restart()}
function setMode(m){mode=m;prepareAttempt();restart()}

function caseKey(q){return q.case_file||'Standalone Practice'}
function caseInfo(key, items){let fallbackTitle=key==='Standalone Practice'?'Standalone Questions':key;let derivedDifficulty=[...new Set(items.map(q=>q.difficulty).filter(Boolean))].join(' / ')||'Mixed';return CASE_DETAILS[key]||{number:key,title:fallbackTitle.replace(/^Case \d+:?\s*/,''),difficulty:derivedDifficulty,scenario:'Practice questions in this pack are grouped together for a focused review session.',context:'Read the question details carefully and use the explanation after submission to reinforce the key learning point.'}}
function groupedCases(){let groups=[];sourceQuestions.forEach(q=>{let key=caseKey(q);let group=groups.find(g=>g.key===key);if(!group){group={key,questions:[]};groups.push(group)}group.questions.push(q)});return groups.map(g=>({...g,info:caseInfo(g.key,g.questions)}))}
function renderCaseSelection(){if(!window.caseSelection)return;let groups=groupedCases();let html='<h2>Case Selection</h2><p class="small">This pack keeps case-file questions grouped so you can work through each investigation in order.</p><div class="case-grid">';groups.forEach(g=>{html+=`<button class="case-select-card" onclick="jumpTo(${firstIndexForCase(g.key)})"><span>${g.info.number}</span><strong>${g.info.title}</strong><em>${g.info.difficulty}</em><small>${g.questions.length} question${g.questions.length===1?'':'s'}</small></button>`});caseSelection.innerHTML=html+'</div>'}
function firstIndexForCase(key){return questions.findIndex(q=>caseKey(q)===key)}
function renderCaseIntro(q){if(!window.caseIntro)return;let key=caseKey(q), first=questions.findIndex(x=>caseKey(x)===key);if(current!==first){caseIntro.innerHTML='';return}let info=caseInfo(key,questions.filter(x=>caseKey(x)===key));caseIntro.innerHTML=`<section class="case-intro"><div><span class="case-number">${info.number}</span><h2>${info.title}</h2></div><span class="case-difficulty">${info.difficulty}</span><p><strong>Scenario introduction:</strong> ${info.scenario}</p><p><strong>Investigation context:</strong> ${info.context}</p></section>`}

function prepareAttempt(){questions=sourceQuestions.map(randomizeQuestionOptions)}
function randomizeQuestionOptions(q){let order=q.options.map((_,i)=>i).sort(()=>Math.random()-.5);if(order.every((oldIdx,newIdx)=>oldIdx===newIdx)&&order.length>1)order.push(order.shift());let newOptions=order.map(i=>q.options[i]);let indexMap={};order.forEach((oldIdx,newIdx)=>indexMap[oldIdx]=newIdx);let newAnswer=q.answer.map(i=>indexMap[i]).sort((a,b)=>a-b);let newWhyWrong={};if(q.why_wrong){Object.entries(q.why_wrong).forEach(([oldIdx,reason])=>{newWhyWrong[indexMap[oldIdx]]=reason})}return {...q,options:newOptions,answer:newAnswer,why_wrong:newWhyWrong,original_order:order}}
function isPbq(q){return (q.qtype||'').toUpperCase().includes('PBQ')}
function secondBest(q){if(q.second_best)return q.second_best;if(q.why_wrong){let idx=Object.keys(q.why_wrong)[0];if(idx!==undefined)return `${q.options[parseInt(idx)]}: ${q.why_wrong[idx]}`}return q.trap||'The tempting choice usually overstates what the evidence proves or skips a required investigation step.'}
function keyClue(q){if(q.key_clue)return q.key_clue;let text=q.question.split('\n').filter(x=>x.trim().startsWith('-')||/Defender|DNS|proxy|internet-facing|active exploitation|isolated|quarantined|CVSS|ransomware/i.test(x)).slice(0,2).join(' ');return text||'The most important clue is the evidence that directly supports scope, impact, or the requested next action.'}
function updateSelectedOptionStyles(){document.querySelectorAll('#options .option').forEach(l=>{let input=l.querySelector('input');l.classList.toggle('selected',!!input?.checked)})}

function render(){let q=questions[current], st=answers[current];renderCaseSelection();renderCaseIntro(q);progress.textContent=`Question ${current+1} / ${questions.length}`;score.textContent=`Score: ${sessionScore}`;meta.textContent=`${q.domain} • ${q.qtype||q.kind} • ${q.difficulty}`;modeBadge.textContent=mode==='practice'?'Practice Mode':'Exam Mode';question.textContent=q.question;question.className=isPbq(q)?'question pbq-question':'question';options.innerHTML='';explanation.innerHTML='';finalAnalytics.innerHTML='';submitBtn.style.display=mode==='practice'&&!st?.submitted?'inline-block':'none';confidenceBox.style.display='block';document.querySelectorAll('input[name=confidence]').forEach(x=>x.checked=st?.confidence===x.value);if(isPbq(q)){let pbq=document.createElement('div');pbq.className='pbq-banner';pbq.innerHTML='<strong>Performance-Based Question</strong><span>Use the same answer controls, but treat this like an evidence-ordering or triage task.</span>';options.appendChild(pbq)}q.options.forEach((opt,idx)=>{let l=document.createElement('label');l.className=isPbq(q)?'option pbq-option':'option';let t=q.kind==='multi'?'checkbox':'radio';l.innerHTML=`<input type="${t}" name="answer" value="${idx}" style="margin-right:10px;">${opt}`;let input=l.querySelector('input');if(st?.selected?.includes(idx)){input.checked=true;l.classList.add('selected')}input.addEventListener('change',()=>{if(q.kind==='multi')enforceSelectLimit(q.select_limit);updateSelectedOptionStyles()});if(st?.submitted||st?.graded){if(q.answer.includes(idx))l.classList.add('correct');if(st.selected?.includes(idx)&&!q.answer.includes(idx))l.classList.add('wrong');input.disabled=true}options.appendChild(l)});if(q.kind==='multi'){let note=document.createElement('p');note.className='small warn';note.textContent=`Select exactly ${q.select_limit}.`;options.prepend(note)}if((st?.submitted&&mode==='practice')||st?.graded)showExplanation(q,st.correct,st.confidence,false);renderNavigator()}
function enforceSelectLimit(limit){let checked=[...document.querySelectorAll('#options input[type=checkbox]:checked')];if(checked.length>limit){checked[checked.length-1].checked=false;alert(`Select only ${limit}.`)}}
function selectedNow(){let q=questions[current], sel=[];let selector=q.kind==='multi'?'#options input[type=checkbox]:checked':'#options input[name=answer]:checked';document.querySelectorAll(selector).forEach(x=>sel.push(parseInt(x.value)));return sel}
function getConf(){let c=document.querySelector('input[name=confidence]:checked');return c?c.value:'not selected'}
function arraysEqual(a,b){return JSON.stringify([...a].sort((x,y)=>x-y))===JSON.stringify([...b].sort((x,y)=>x-y))}
function saveCurrentDraft(){let q=questions[current];if(answers[current]?.submitted||answers[current]?.graded)return;let sel=selectedNow();let conf=getConf();if(sel.length||conf!=='not selected')answers[current]={...(answers[current]||{}),selected:sel,confidence:conf}}
function submitAnswer(){let q=questions[current], sel=selectedNow();if(q.kind==='multi'&&sel.length!==q.select_limit){alert(`Please select exactly ${q.select_limit}.`);return}if(q.kind==='single'&&sel.length!==1){alert('Please select one answer.');return}let correct=arraysEqual(sel,q.answer), conf=getConf();answers[current]={selected:sel,confidence:conf,correct,submitted:true,graded:true};if(correct)sessionScore++;updateStats({domain:q.domain,topic:q.topic||'',mistake:correct?'':q.mistake_type,correct,confidence:conf});if(!correct){let l=getLists();if(!l.incorrect.includes(qkey()))l.incorrect.push(qkey());saveLists(l)}render()}
function gradeExam(){sessionScore=0;questions.forEach((q,i)=>{let st=answers[i]||{selected:[],confidence:'not selected'};let correct=arraysEqual(st.selected||[],q.answer);answers[i]={...st,correct,graded:true,submitted:true};if(correct)sessionScore++;updateStats({domain:q.domain,topic:q.topic||'',mistake:correct?'':q.mistake_type,correct,confidence:st.confidence||'not selected'});if(!correct){let l=getLists();let key=`${packSelect.value}::${q.id}`;if(!l.incorrect.includes(key))l.incorrect.push(key);saveLists(l)}})}
function showExplanation(q,correct,conf,wrap=true){let h=`<div class="explanation"><strong>${correct?'Correct':'Not quite'}.</strong> Confidence: <strong>${conf}</strong><br><br>`;h+=`<strong>Correct answer${q.answer.length>1?'s':''}:</strong> ${q.answer.map(i=>q.options[i]).join('; ')}<br><br><strong>Why the correct answer is correct:</strong><br>${q.why_correct}<br><br><strong>Why the second-best answer was tempting:</strong><br>${secondBest(q)}<br><br><strong>Scenario clue that mattered most:</strong><br>${keyClue(q)}<br><br><strong>CompTIA trap:</strong><br>${q.trap}<br><br><strong>Exam takeaway:</strong><br>${q.takeaway}`;if(!correct&&q.mistake_type)h+=`<div class="coach"><strong>Coach note:</strong><br>This miss may indicate: ${q.mistake_type}.</div>`;if(q.why_wrong){h+='<br><br><strong>Why the other answers are wrong:</strong><ul>';for(let [idx,reason] of Object.entries(q.why_wrong))h+=`<li><strong>${q.options[parseInt(idx)]}:</strong> ${reason}</li>`;h+='</ul>'}explanation.innerHTML=h+'</div>'}
function nextQuestion(){saveCurrentDraft();if(current<questions.length-1){current++;render()}else finish()}
function prevQuestion(){saveCurrentDraft();if(current>0){current--;render()}}
function jumpTo(i){saveCurrentDraft();current=i;render()}
function toggleFlag(){let k=qkey();flagged.has(k)?flagged.delete(k):flagged.add(k);persistLists();renderNavigator()}
function toggleFavorite(){let k=qkey();favorites.has(k)?favorites.delete(k):favorites.add(k);persistLists();renderNavigator()}
function persistLists(){let l=getLists();l.flagged=[...flagged];l.favorites=[...favorites];saveLists(l)}
function renderNavigator(){let html='';questions.forEach((q,i)=>{let key=`${packSelect.value}::${q.id}`, st=answers[i]||{};let cls='navBtn';let isSubmitted=!!(st.submitted||st.graded);let hasSelection=!!(st.selected&&st.selected.length);if(isSubmitted)cls+=' navAnswered';else if(hasSelection)cls+=' navSelected';if(flagged.has(key))cls+=' navFlagged';if(favorites.has(key))cls+=' navFavorite';if(st.graded&&!st.correct)cls+=' navIncorrect';if(i===current)cls+=' navCurrent';if(isPbq(q))cls+=' navPbq';let icons=(isSubmitted?'✓ ':(hasSelection?'○ ':''))+(flagged.has(key)?'⚑ ':'')+(favorites.has(key)?'⭐ ':'')+(st.graded&&!st.correct?'❌ ':'')+(isPbq(q)?'PBQ ':'');html+=`<button class="${cls}" onclick="jumpTo(${i})">Q${i+1} ${icons}<br><span class="small">${q.topic}</span></button>`});sideNavigator.innerHTML=html}
function showStudyList(type){let l=getLists(), arr=l[type]||[], title=type==='flagged'?'Flagged Questions':type==='incorrect'?'Incorrect Questions':'Favorite Questions';let html=`<div class="reviewList"><h2>${title}</h2>`;if(!arr.length)html+='<p class="small">Nothing saved here yet.</p>';arr.forEach(k=>{let id=k.split('::').pop();let q=questions.find(x=>String(x.id)===String(id));if(q)html+=`<div class="reviewItem"><span><strong>Q${questions.indexOf(q)+1}</strong> — ${q.topic}<br><span class="small">${q.domain}</span></span><button onclick="jumpTo(${questions.indexOf(q)})">Review</button></div>`});finalAnalytics.innerHTML=html+'</div>'}
function finish(){saveCurrentDraft();if(mode==='exam'&&!Object.values(answers).some(x=>x.graded))gradeExam();caseIntro.innerHTML='';question.textContent=`Session complete! Score: ${sessionScore} / ${questions.length}`;question.className='question';options.innerHTML='';explanation.innerHTML='';confidenceBox.style.display='none';submitBtn.style.display='none';let by={};questions.forEach((q,i)=>{let st=answers[i]||{};if(!by[q.domain])by[q.domain]={t:0,c:0};by[q.domain].t++;if(st.correct)by[q.domain].c++});let html='<div class="analytics"><h2>Review Summary</h2><div class="grid">';html+=`<div class="metric"><strong>Score</strong><br>${pct(sessionScore,questions.length)}%</div><div class="metric"><strong>Flagged</strong><br>${[...flagged].filter(k=>k.startsWith(packSelect.value)).length}</div><div class="metric"><strong>Incorrect</strong><br>${Object.values(answers).filter(x=>x.graded&&!x.correct).length}</div>`;Object.entries(by).forEach(([d,v])=>html+=`<div class="metric"><strong>${d}</strong><br>${v.c}/${v.t} (${pct(v.c,v.t)}%)</div>`);finalAnalytics.innerHTML=html+'</div></div>';renderNavigator()}
function restart(){current=0;sessionScore=0;answers={};prepareAttempt();if(questions.length)render()}
function shuffleQuiz(){let grouped=groupedCases().map(g=>sourceQuestions.filter(q=>caseKey(q)===g.key));sourceQuestions=grouped.sort(()=>Math.random()-.5).flatMap(group=>group);restart()}
function resetProgress(){if(confirm('Reset saved progress and lists?')){localStorage.removeItem(STORE);localStorage.removeItem(LISTS);flagged=new Set();favorites=new Set();updateDashboard();restart()}}
init();
