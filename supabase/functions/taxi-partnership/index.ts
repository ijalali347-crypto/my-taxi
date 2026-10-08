
const cors={"Access-Control-Allow-Origin":"https://ijalali347-crypto.github.io","Access-Control-Allow-Headers":"content-type,x-edit-token,apikey,authorization","Access-Control-Allow-Methods":"GET,POST,DELETE,OPTIONS","Vary":"Origin"};
const columns="id,driver_name,area,shift,phone,availability,company,updated_at,expires_at";
function reply(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});}
async function hash(token){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token))),n=>n.toString(16).padStart(2,"0")).join("");}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(!["GET","POST","DELETE"].includes(req.method))return reply({error:"Unsupported request"},405);
 const origin=req.headers.get("Origin");
 if(origin&&origin!=="https://ijalali347-crypto.github.io")return reply({error:"Unsupported origin"},403);
 const url=new URL(req.url),token=req.headers.get("x-edit-token"),mine=url.searchParams.get("mine")==="1";
 // Public reads require no login. Every private read or write authenticates a 256-bit editing capability.
 if((req.method!=="GET"||mine)&&(!token||!/^[a-f0-9]{64}$/.test(token)))return reply({error:"Private editing key missing. Use the device where you posted."},401);
 try{
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),base=Deno.env.get("SUPABASE_URL");
  if(!key||!base)return reply({error:"Partnership service unavailable"},503);
  const db=async(path,options={})=>{
    const r=await fetch(base+"/rest/v1/taxi_partner_listings"+path,{...options,headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",...options.headers},signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw new Error("Database request failed");
    return r.status===204?null:await r.json();
  };
  if(req.method==="GET"){
    if(mine){const rows=await db("?edit_token_hash=eq."+await hash(token)+"&select="+columns);return reply({listing:rows[0]??null});}
    const offset=Math.max(0,Math.min(100000,Number(url.searchParams.get("offset"))||0));
    const rows=await db("?availability=eq.available&expires_at=gt."+encodeURIComponent(new Date().toISOString())+"&select="+columns+"&order=updated_at.desc&limit=51&offset="+offset);
    return reply({listings:rows.slice(0,50),hasMore:rows.length>50});
  }
  const ownerHash=await hash(token);
  if(req.method==="DELETE"){await db("?edit_token_hash=eq."+ownerHash,{method:"DELETE",headers:{Prefer:"return=minimal"}});return reply({removed:true});}
  if(Number(req.headers.get("content-length"))>4096)return reply({error:"Listing too large"},413);
  const text=await req.text();if(text.length>4096)return reply({error:"Listing too large"},413);
  let input;try{input=JSON.parse(text);}catch{return reply({error:"Invalid listing"},400);}
  const driver_name=String(input.driver_name||"").trim(),area=String(input.area||"").trim(),phone=String(input.phone||"").trim();
  if(input.publish_consent!==true)return reply({error:"Confirm that your phone and area will be public."},400);
  if(!driver_name||driver_name.length>60||area.length<2||area.length>100||!/^\+[0-9]{8,15}$/.test(phone)||!["day","night"].includes(input.shift)||!["available","matched"].includes(input.availability)||!["arabia","dtc","kabi"].includes(input.company))return reply({error:"Check name, area, shift and international phone number (example +971501234567)."},400);
  const row={edit_token_hash:ownerHash,driver_name,area,phone,shift:input.shift,availability:input.availability,company:input.company,updated_at:new Date().toISOString(),expires_at:new Date(Date.now()+30*86400000).toISOString()};
  const rows=await db("?on_conflict=edit_token_hash&select="+columns,{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(row)});
  return reply({listing:rows[0]});
 }catch{return reply({error:"Unable to connect. Your collection records are unchanged. Try again online."},503);}
});
