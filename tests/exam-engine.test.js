const assert=require('node:assert/strict');
const test=require('node:test');
const engine=require('../js/exam-engine.js');
const fs=require('node:fs');
const path=require('node:path');

function question(id,answer=[id%4],kind='single'){
  return {id,kind,options:[`${id}-A`,`${id}-B`,`${id}-C`,`${id}-D`],answer,why_wrong:{0:'zero',1:'one',2:'two',3:'three'}};
}
function seeded(){let n=42;return()=>((n=n*1664525+1013904223>>>0)/2**32)}

test('single-answer letters are balanced without three-letter runs',()=>{
  const result=engine.balanceQuestionOptions(Array.from({length:85},(_,i)=>question(i)),seeded());
  const counts=[0,0,0,0];result.forEach(q=>counts[q.answer[0]]++);
  assert.ok(Math.max(...counts)-Math.min(...counts)<=1,counts);
  assert.equal(result.some((q,i)=>i>1&&q.answer[0]===result[i-1].answer[0]&&q.answer[0]===result[i-2].answer[0]),false);
});

test('shuffling remaps answers and why-wrong explanations to their original option',()=>{
  const original=question(7,[1,3],'multi');
  const result=engine.remapQuestion(original,[0,2],seeded());
  assert.deepEqual(result.answer.map(i=>result.options[i]).sort(),[original.options[1],original.options[3]].sort());
  Object.entries(original.why_wrong).forEach(([oldIndex,reason])=>assert.equal(result.why_wrong[result.options.indexOf(original.options[oldIndex])],reason));
});

test('an attempt keeps its option order while navigation reuses question objects',()=>{
  const attempt=engine.balanceQuestionOptions([question(1),question(2),question(3)],seeded());
  const snapshot=attempt.map(q=>q.options.join('|'));
  [2,0,1,2,0].forEach(index=>assert.equal(attempt[index].options.join('|'),snapshot[index]));
});

test('85-question exams place two to four available PBQs first',()=>{
 const bank=Array.from({length:85},(_,i)=>({...question(i),qtype:i<6?'PBQ':'NEXT'}));
 const exam=engine.generateExam(bank,85,seeded());
 const leading=exam.findIndex(q=>!engine.isPbq(q));
 assert.ok(leading>=2&&leading<=4,leading);
 assert.equal(exam.length,85);
});

test('question bank v2 batch 1 satisfies its schema and content contract',()=>{
  const productionPath=path.join(__dirname,'../questions/exam-sim-v2-batch1.json');
  const legacyPath=path.join(__dirname,'../questions/exam-sim-release1.json');
  const bank=JSON.parse(fs.readFileSync(productionPath,'utf8'));
  const legacy=JSON.parse(fs.readFileSync(legacyPath,'utf8'));
  const ids=[...legacy,...bank].map(q=>q.id);
  assert.equal(new Set(ids).size,ids.length,'question IDs must be unique across the bank');

  const batch=bank.filter(q=>q.id>=30201&&q.id<=30225);
  assert.equal(batch.length,25,'batch must contain exactly 25 questions');
  assert.equal(batch.length,bank.length,'production bank must contain no legacy questions');
  assert.equal(legacy.some(q=>q.id>=30201&&q.id<=30225),false,'legacy bank must contain no production questions');
  const appSource=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
  assert.match(appSource,/const EXAM_PACK='questions\/exam-sim-v2-batch1\.json'/,'exam modes must load only the production bank');

  const objectiveLabels={
    '1.2':'Analyze indicators of potentially malicious activity',
    '2.1':'Implement vulnerability scanning methods and concepts',
    '2.2':'Analyze output from vulnerability assessment tools',
    '2.3':'Analyze data to prioritize vulnerabilities',
    '2.4':'Recommend controls to mitigate attacks and software vulnerabilities',
    '3.1':'Explain concepts related to attack methodology frameworks',
    '3.2':'Perform incident response activities',
    '3.3':'Explain preparation and post-incident activity phases of the incident response lifecycle',
    '4.1':'Explain the importance of vulnerability management reporting and communication',
    '4.2':'Explain the importance of incident response reporting and communication'
  };
  const giveawayPattern=/delete all|disable (?:all )?logging|rm -rf|display name|terminal colou?r|social media rumor|annual audit|scanner plugin|comment length/i;
  const required=['id','domain','objective_id','objective','tier','difficulty','topic','kind','select_limit','options','answer','explanation','why_correct','why_wrong','second_best','key_clue','trap','takeaway','concept_tags','mistake_type','distractor_quality','quality_score','reasoning_depth','distractor_strength','decisive_clue_present','plausible_alternative_count','psychometric_notes'];
  batch.forEach(q=>{
    required.forEach(field=>assert.ok(Object.hasOwn(q,field),`${q.id} missing ${field}`));
    assert.equal(q.options.length,4,`${q.id} must have four options`);
    assert.ok(['single','multi'].includes(q.kind),`${q.id} has invalid kind`);
    assert.equal(q.select_limit,q.answer.length,`${q.id} select_limit mismatch`);
    assert.ok(q.kind==='single'?q.answer.length===1:q.answer.length>1,`${q.id} kind/answer mismatch`);
    assert.equal(new Set(q.answer).size,q.answer.length,`${q.id} repeats an answer index`);
    q.answer.forEach(index=>assert.ok(Number.isInteger(index)&&index>=0&&index<q.options.length,`${q.id} has invalid answer index`));
    q.options.forEach((_,index)=>{
      if(!q.answer.includes(index)){
        assert.ok(q.why_wrong[index],`${q.id} missing why_wrong for option ${index}`);
        assert.ok(q.distractor_quality[index],`${q.id} missing distractor quality for option ${index}`);
        assert.doesNotMatch(q.options[index],giveawayPattern,`${q.id} contains a giveaway distractor`);
      }
    });
    assert.equal(q.objective,objectiveLabels[q.objective_id],`${q.id} has an unsupported objective mapping`);
    const credible=Object.values(q.distractor_quality).filter(value=>value==='credible_runner_up').length;
    assert.ok(credible>=(q.tier===2?1:2),`${q.id} lacks credible alternatives for its tier`);
    assert.equal(q.plausible_alternative_count,credible,`${q.id} plausible-alternative count is inconsistent`);
    assert.ok(q.plausible_alternative_count>=(q.tier===2?1:2),`${q.id} plausible-alternative count is too low`);
    assert.ok(Number.isInteger(q.quality_score)&&q.quality_score>=4&&q.quality_score<=5,`${q.id} has an invalid quality score`);
    assert.ok(['recognition','application','analysis','evaluation'].includes(q.reasoning_depth),`${q.id} has invalid reasoning depth`);
    if(q.tier>=3)assert.notEqual(q.reasoning_depth,'recognition',`${q.id} cannot be recognition at Tier ${q.tier}`);
    assert.ok(['weak','acceptable','strong','expert'].includes(q.distractor_strength),`${q.id} has invalid distractor strength`);
    if(q.tier>=3)assert.ok(['strong','expert'].includes(q.distractor_strength),`${q.id} distractors are too weak for Tier ${q.tier}`);
    assert.equal(q.decisive_clue_present,true,`${q.id} must contain a decisive clue`);
    assert.ok(typeof q.psychometric_notes==='string'&&q.psychometric_notes.trim(),`${q.id} needs psychometric notes`);
    assert.ok(Array.isArray(q.concept_tags)&&q.concept_tags.length>0,`${q.id} needs concept tags`);
  });

  const countBy=field=>Object.fromEntries([...new Set(batch.map(q=>q[field]))].sort().map(value=>[value,batch.filter(q=>q[field]===value).length]));
  assert.deepEqual(countBy('domain'),{
    'Incident Response and Management':5,
    'Reporting and Communication':5,
    'Security Operations':8,
    'Vulnerability Management':7
  });
  assert.deepEqual(countBy('tier'),{'2':8,'3':14,'4':3});
  assert.deepEqual(countBy('difficulty'),{'Exam':14,'Exam Killer':3,'Practice':8});
  assert.deepEqual(countBy('kind'),{multi:4,single:21});
});

test('question bank v2 batch 2 satisfies its schema and psychometric contract',()=>{
  const batch1=JSON.parse(fs.readFileSync(path.join(__dirname,'../questions/exam-sim-v2-batch1.json'),'utf8'));
  const batch2=JSON.parse(fs.readFileSync(path.join(__dirname,'../questions/exam-sim-v2-batch2.json'),'utf8'));
  const legacy=JSON.parse(fs.readFileSync(path.join(__dirname,'../questions/exam-sim-release1.json'),'utf8'));
  assert.equal(batch2.length,25,'batch 2 must contain exactly 25 questions');
  assert.ok(batch2.every(q=>q.id>=30301&&q.id<=30325),'batch 2 contains an out-of-range ID');
  const allIds=[...legacy,...batch1,...batch2].map(q=>q.id);
  assert.equal(new Set(allIds).size,allIds.length,'question IDs must be globally unique');

  const objectiveIds=new Set(['1.2','1.3','1.4','1.5','2.2','2.3','2.4','2.5','3.2','3.3','4.1','4.2']);
  const required=['id','domain','objective','objective_id','tier','difficulty','topic','kind','select_limit','options','answer','explanation','why_correct','why_wrong','second_best','key_clue','trap','takeaway','concept_tags','mistake_type','misconception','distractor_quality','quality_score','reasoning_depth','distractor_strength','decisive_clue_present','plausible_alternative_count','psychometric_notes'];
  batch2.forEach(q=>{
    required.forEach(field=>assert.ok(Object.hasOwn(q,field),`${q.id} missing ${field}`));
    assert.ok(objectiveIds.has(q.objective_id),`${q.id} has an unsupported objective ID`);
    assert.equal(q.options.length,4,`${q.id} must have four options`);
    assert.ok(['single','multi'].includes(q.kind),`${q.id} has invalid kind`);
    assert.equal(q.select_limit,q.answer.length,`${q.id} select_limit mismatch`);
    assert.ok(q.kind==='single'?q.answer.length===1:q.answer.length>1,`${q.id} kind/answer mismatch`);
    assert.equal(new Set(q.answer).size,q.answer.length,`${q.id} repeats an answer index`);
    q.answer.forEach(index=>assert.ok(Number.isInteger(index)&&index>=0&&index<4,`${q.id} has invalid answer index`));
    const wrong=q.options.map((_,index)=>index).filter(index=>!q.answer.includes(index));
    wrong.forEach(index=>{
      assert.ok(q.why_wrong[index],`${q.id} missing why_wrong for option ${index}`);
      assert.ok(q.distractor_quality[index],`${q.id} missing distractor quality for option ${index}`);
    });
    const credible=Object.values(q.distractor_quality).filter(value=>value==='credible_runner_up').length;
    assert.equal(q.plausible_alternative_count,credible,`${q.id} plausible-alternative count mismatch`);
    assert.ok(credible>=(q.tier===2?1:2),`${q.id} lacks credible alternatives for its tier`);
    assert.ok(Number.isInteger(q.quality_score)&&q.quality_score>=4&&q.quality_score<=5,`${q.id} has invalid quality score`);
    assert.equal(q.decisive_clue_present,true,`${q.id} lacks a decisive clue`);
    assert.ok(['application','analysis','evaluation'].includes(q.reasoning_depth),`${q.id} has insufficient reasoning depth`);
    if(q.tier>=3)assert.ok(['strong','expert'].includes(q.distractor_strength),`${q.id} distractors are too weak`);
    assert.ok(q.misconception.trim()&&q.psychometric_notes.trim(),`${q.id} lacks quality notes`);
    assert.equal(engine.isPbq(q),false,`${q.id} must not be a PBQ`);
  });

  const countBy=field=>Object.fromEntries([...new Set(batch2.map(q=>q[field]))].sort().map(value=>[value,batch2.filter(q=>q[field]===value).length]));
  assert.deepEqual(countBy('domain'),{
    'Incident Response and Management':6,
    'Reporting and Communication':6,
    'Security Operations':7,
    'Vulnerability Management':6
  });
  assert.deepEqual(countBy('tier'),{'2':6,'3':16,'4':3});
  assert.deepEqual(countBy('kind'),{single:25});
  const appSource=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
  assert.match(appSource,/EXAM_BANK_FILES=\[EXAM_PACK,'questions\/exam-sim-v2-batch2\.json'\]/,'exam simulator must load batch 2');
});
