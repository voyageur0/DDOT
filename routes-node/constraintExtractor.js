const OpenAI = require('openai');
require('dotenv').config();

// Client OpenAI
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Vous êtes un expert en droit de la construction suisse. 
À partir du texte fourni, extrayez toutes les contraintes urbanistiques sous forme JSON.
Format: [{"zone":"R3","theme":"Destination de zone","rule":"≥ 80 % logements collectifs","article":"Art. 6, al. 2"}, …]`;

async function safeChat(params, retries = 2) {
  try {
    return await client.chat.completions.create(params);
  } catch (err) {
    if (retries > 0) {
      console.log('Retry chat...', retries, err.message);
      return safeChat(params, retries - 1);
    }
    throw err;
  }
}

async function callChat(messages){
  return await safeChat({
    model: 'o3-mini',
    temperature: 0,
    messages,
    max_tokens: 1500
  });
}

async function extractRegulationConstraints(rawText){
  if(!rawText || rawText.length<50) return [];
  const messages=[{role:'system',content:SYSTEM_PROMPT},{role:'user',content:rawText.slice(0,12000)}];
  try{
    const resp=await callChat(messages);
    const content=resp.choices[0].message.content||'[]';
    const jsonStart=content.indexOf('[');
    const jsonEnd=content.lastIndexOf(']')+1;
    const jsonString=content.slice(jsonStart,jsonEnd);
    return JSON.parse(jsonString);
  }catch(e){
    console.error('Erreur extraction contraintes:',e);
    return [];
  }
}

async function extractConstraintsFromLargeText(rawText){
  const CHUNK_SIZE=10000;
  let all=[];
  for(let i=0;i<rawText.length;i+=CHUNK_SIZE){
    const chunk=rawText.slice(i,i+CHUNK_SIZE);
    /* eslint-disable no-await-in-loop */
    const c=await extractRegulationConstraints(chunk);
    all.push(...c);
  }
  const map=new Map();
  for(const c of all){
    const key=`${c.zone}-${c.theme}-${c.rule}`;
    if(!map.has(key)) map.set(key,c);
  }
  return Array.from(map.values());
}

module.exports={extractRegulationConstraints,extractConstraintsFromLargeText}; 