const assert=require('node:assert/strict');
const test=require('node:test');
const engine=require('../js/exam-engine.js');

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
