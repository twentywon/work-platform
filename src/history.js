export class EditHistory {
 constructor(limit=50){this.limit=limit;this.past=[];this.future=[];this.current=null;}
 reset(state){this.current=structuredClone(state);this.past=[];this.future=[];}
 record(state,mergeKey='',now=Date.now()) {
  if(!this.current){this.reset(state);return;}
  const next=structuredClone(state);
  if(JSON.stringify(next.pages)===JSON.stringify(this.current.pages)){this.current.active=next.active;return;}
  const last=this.past.at(-1);
  if(mergeKey&&last?.mergeKey===mergeKey&&now-last.time<800&&!this.future.length){last.after=next;last.time=now;}
  else{this.past.push({before:this.current,after:next,mergeKey,time:now});if(this.past.length>this.limit)this.past.shift();}
  this.current=next;this.future=[];
 }
 undo(){const item=this.past.pop();if(!item)return null;this.future.push(item);this.current=structuredClone(item.before);return structuredClone(this.current);}
 redo(){const item=this.future.pop();if(!item)return null;this.past.push(item);this.current=structuredClone(item.after);return structuredClone(this.current);}
}
