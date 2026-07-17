(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.ExamEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const LETTERS=['A','B','C','D'];

  function fisherYates(items,rng=Math.random){
    const result=[...items];
    for(let i=result.length-1;i>0;i--){
      const j=Math.floor(rng()*(i+1));
      [result[i],result[j]]=[result[j],result[i]];
    }
    return result;
  }

  function combinations(length,count,start=0,prefix=[]){
    if(prefix.length===count)return [prefix];
    let result=[];
    for(let i=start;i<length;i++)result=result.concat(combinations(length,count,i+1,[...prefix,i]));
    return result;
  }

  function balancedSingleTargets(count,rng=Math.random){
    const remaining=Array(LETTERS.length).fill(Math.floor(count/LETTERS.length));
    fisherYates(LETTERS.map((_,i)=>i),rng).slice(0,count%LETTERS.length).forEach(i=>remaining[i]++);
    const result=[];
    while(result.length<count){
      const choices=fisherYates(LETTERS.map((_,i)=>i),rng).filter(i=>remaining[i]&&!(result.length>1&&result.at(-1)===i&&result.at(-2)===i));
      choices.sort((a,b)=>remaining[b]-remaining[a]);
      const chosen=choices[0];
      result.push(chosen);
      remaining[chosen]--;
    }
    return result;
  }

  function remapQuestion(question,targetCorrect,rng=Math.random){
    const correct=[...question.answer];
    const target=[...targetCorrect].sort((a,b)=>a-b);
    const wrong=question.options.map((_,i)=>i).filter(i=>!correct.includes(i));
    const remaining=question.options.map((_,i)=>i).filter(i=>!target.includes(i));
    const order=Array(question.options.length);
    fisherYates(correct,rng).forEach((oldIndex,i)=>{order[target[i]]=oldIndex});
    fisherYates(wrong,rng).forEach((oldIndex,i)=>{order[remaining[i]]=oldIndex});
    const indexMap={};
    order.forEach((oldIndex,newIndex)=>{indexMap[oldIndex]=newIndex});
    const whyWrong={};
    Object.entries(question.why_wrong||{}).forEach(([oldIndex,reason])=>{whyWrong[indexMap[oldIndex]]=reason});
    return {...question,options:order.map(i=>question.options[i]),answer:correct.map(i=>indexMap[i]).sort((a,b)=>a-b),why_wrong:whyWrong,original_order:order};
  }

  function balanceQuestionOptions(questions,rng=Math.random){
    const singleTargets=balancedSingleTargets(questions.filter(q=>q.answer.length===1&&q.options.length===4).length,rng);
    let singleIndex=0;
    const multiFrequency=Array(4).fill(0),combinationUse={};
    return questions.map(question=>{
      if(question.options.length!==4)return remapQuestion(question,fisherYates(question.answer,rng),rng);
      if(question.answer.length===1)return remapQuestion(question,[singleTargets[singleIndex++]],rng);
      const candidates=combinations(4,question.answer.length);
      const ranked=fisherYates(candidates,rng).sort((a,b)=>{
        const score=c=>c.reduce((sum,i)=>sum+multiFrequency[i],0)+(combinationUse[c.join('')]||0)*2;
        return score(a)-score(b);
      });
      const target=ranked[0];
      target.forEach(i=>multiFrequency[i]++);
      combinationUse[target.join('')]=(combinationUse[target.join('')]||0)+1;
      return remapQuestion(question,target,rng);
    });
  }

  function isPbq(question){
    return ((question.qtype||question.question_type||'')+' '+(question.topic||'')).toUpperCase().includes('PBQ');
  }

  function generateExam(bank,count,rng=Math.random){
    const requested=Math.min(count,bank.length);
    if(count===85){
      const pbqs=fisherYates(bank.filter(isPbq),rng);
      const pbqCount=Math.min(pbqs.length,Math.min(4,Math.max(2,Math.floor(2+rng()*3))),requested);
      const first=pbqs.slice(0,pbqCount);
      const ids=new Set(first.map(q=>q.id));
      return first.concat(fisherYates(bank.filter(q=>!ids.has(q.id)),rng).slice(0,requested-first.length));
    }
    return fisherYates(bank,rng).slice(0,requested);
  }

  return {LETTERS,fisherYates,balancedSingleTargets,remapQuestion,balanceQuestionOptions,generateExam,isPbq};
});
