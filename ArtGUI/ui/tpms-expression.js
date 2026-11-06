// Restricted scalar mathematical expressions. No JavaScript evaluation or
// access to properties, global objects, statements, or user-defined functions.
const unary={sin:Math.sin,cos:Math.cos,tan:Math.tan,arcsin:Math.asin,arccos:Math.acos,arctan:Math.atan,sinh:Math.sinh,cosh:Math.cosh,tanh:Math.tanh,arcsinh:Math.asinh,arccosh:Math.acosh,arctanh:Math.atanh,exp:Math.exp,expm1:Math.expm1,log:Math.log,log10:Math.log10,log2:Math.log2,log1p:Math.log1p,sqrt:Math.sqrt,abs:Math.abs};
const binary={arctan2:Math.atan2,minimum:Math.min,maximum:Math.max};
export const TPMS_FUNCTIONS=[...Object.keys(unary),...Object.keys(binary),'where'];
export function compileTpmsExpression(source,{coordinates=true}={}){
 source=String(source??'');if(!source.trim())throw Error('Enter a mathematical expression.');if(source.length>4096)throw Error('The expression is too long for the local preview.');
 const tokens=[];let cursor=0;
 while(cursor<source.length){if(/\s/.test(source[cursor])){cursor++;continue;}const rest=source.slice(cursor);let m=/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);if(m){const value=Number(m[0]);if(!Number.isFinite(value))throw Error('Numeric constants must be finite.');tokens.push({kind:'number',value,pos:cursor});cursor+=m[0].length;}else if(m=/^[A-Za-z_][A-Za-z_0-9]*/.exec(rest)){tokens.push({kind:'name',value:m[0],pos:cursor});cursor+=m[0].length;}else if(m=/^(?:\*\*|\/\/|<=|>=|==|!=|[+\-*/%<>()\u002c])/.exec(rest)){tokens.push({kind:'operator',value:m[0],pos:cursor});cursor+=m[0].length;}else if(rest[0]==='^')throw Error('Use ** for powers; ^ is not a power operator.');else throw Error('Unsupported character at position '+(cursor+1)+'.');if(tokens.length>1024)throw Error('The expression has too many terms for the local preview.');}
 tokens.push({kind:'end',value:'',pos:cursor});let index=0,depth=0,nodes=0;const variables=new Set(),peek=()=>tokens[Math.min(index,tokens.length-1)],pop=()=>tokens[Math.min(index++,tokens.length-1)];
 const fail=message=>{throw Error(message+' (position '+(peek().pos+1)+')');};
 const expect=s=>{if(peek().value!==s)fail('Expected '+s);pop();};
 const precedence={'==':5,'!=':5,'<':5,'<=':5,'>':5,'>=':5,'+':10,'-':10,'*':20,'/':20,'//':20,'%':20,'**':40};
 function expression(min=0){if(++depth>64)fail('Expression nesting is too deep');if(++nodes>256)fail('The expression has too many terms');let left,compared=false;const token=pop();
  if(token.kind==='number'){const n=token.value;left=()=>n;}
  else if(token.value==='+'||token.value==='-'){const arg=expression(30);left=token.value==='-'?(x,y,z)=>-arg(x,y,z):arg;}
  else if(token.value==='('){left=expression();expect(')');}
  else if(token.kind==='name'){
   const name=token.value;
   if(peek().value==='('){pop();const args=[];if(peek().value!==')'){do{args.push(expression());if(peek().value!==',')break;pop();}while(true);}expect(')');const arity=Object.hasOwn(unary,name)?1:Object.hasOwn(binary,name)?2:name==='where'?3:0;if(!arity)fail('Unsupported function: '+name);if(args.length!==arity)fail(name+' requires '+arity+' arguments');
    if(arity===1){const fn=unary[name],a=args[0];left=(x,y,z)=>fn(a(x,y,z));}else if(arity===2){const fn=binary[name],[a,b]=args;left=(x,y,z)=>fn(a(x,y,z),b(x,y,z));}else{const [a,b,c]=args;left=(x,y,z)=>a(x,y,z)?b(x,y,z):c(x,y,z);}
   }else if(name==='pi')left=()=>Math.PI;
   else if(coordinates&&['x','y','z'].includes(name)){variables.add(name);left=name==='x'?(x)=>x:name==='y'?(_x,y)=>y:(_x,_y,z)=>z;}
   else fail(coordinates?'Unknown variable: '+name:'Periods must be constant expressions without coordinate variables');
  }else fail('Expected a number, coordinate or function');
  while(Object.hasOwn(precedence,peek().value)&&precedence[peek().value]>=min){const op=pop().value;if(precedence[op]===5){if(compared)fail('Chained comparisons are not supported');compared=true;}const right=expression(precedence[op]+(op==='**'?0:1)),a=left,b=right;
   switch(op){case '+':left=(x,y,z)=>a(x,y,z)+b(x,y,z);break;case '-':left=(x,y,z)=>a(x,y,z)-b(x,y,z);break;case '*':left=(x,y,z)=>a(x,y,z)*b(x,y,z);break;case '/':left=(x,y,z)=>a(x,y,z)/b(x,y,z);break;case '//':left=(x,y,z)=>Math.floor(a(x,y,z)/b(x,y,z));break;case '%':left=(x,y,z)=>{const v=a(x,y,z),w=b(x,y,z);return v-Math.floor(v/w)*w;};break;case '**':left=(x,y,z)=>a(x,y,z)**b(x,y,z);break;case '==':left=(x,y,z)=>+(a(x,y,z)===b(x,y,z));break;case '!=':left=(x,y,z)=>+(a(x,y,z)!==b(x,y,z));break;case '<':left=(x,y,z)=>+(a(x,y,z)<b(x,y,z));break;case '<=':left=(x,y,z)=>+(a(x,y,z)<=b(x,y,z));break;case '>':left=(x,y,z)=>+(a(x,y,z)>b(x,y,z));break;case '>=':left=(x,y,z)=>+(a(x,y,z)>=b(x,y,z));break;}
  }depth--;return left;
 }
 const evaluate=expression();if(peek().kind!=='end')fail('Unexpected token');return{evaluate,variables:[...variables]};
}
export function tpmsPeriod(source){const value=compileTpmsExpression(source,{coordinates:false}).evaluate();if(!Number.isFinite(value)||value<=0)throw Error('Equation periods must be finite and greater than zero.');return value;}
