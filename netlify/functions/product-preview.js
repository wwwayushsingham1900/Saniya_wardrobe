// Public product metadata only. Never supplies fabricated photos or prices.
// Some stores block server access; the UI still saves the link and lets users edit.
const allowed=['myntra.com','ajio.com','hm.com','zara.com','uniqlo.com','amazon.in','amazon.com','flipkart.com','meesho.com','adidas.co.in','nike.com','snitch.co.in','westside.com','tatacliq.com','nykaafashion.com','marksandspencer.in','bewakoof.com','thebearhouse.com','urbanic.com','souledstore.com'];
const match=h=>allowed.some(d=>h===d||h.endsWith('.'+d));
const decode=s=>String(s||'').replace(/&(?:amp|quot|apos|lt|gt|#39|#x27);/g,t=>({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&#39;':"'",'&#x27;':"'"}[t]||t)).replace(/\s+/g,' ').trim();
function readMeta(html){const result={};for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){const attrs={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[m[1].toLowerCase()]=m[2]??m[3]??m[4];const key=(attrs.property||attrs.name||'').toLowerCase();if(key&&attrs.content){if(result[key]===undefined)result[key]=decode(attrs.content);else if(key==='og:image')result[key]+='\n'+decode(attrs.content)}}return result}
function productsFromJsonLd(html){const nodes=[];const walk=x=>{if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(walk);return}if(String(x['@type']||'').toLowerCase().includes('product'))nodes.push(x);if(x['@graph'])walk(x['@graph']);if(x.mainEntity)walk(x.mainEntity)};for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{walk(JSON.parse(match[1]))}catch{}}return nodes}
function cleanImages(raw,base){const a=Array.isArray(raw)?raw:(typeof raw==='string'?raw.split('\n'):[raw]);return [...new Set(a.map(x=>{if(x&&typeof x==='object')x=x.url||x.contentUrl;try{if(!x||typeof x!=='string')return '';const u=new URL(x,base);return u.protocol==='https:'?u.href:''}catch{return ''}}).filter(Boolean))].slice(0,5)}
function fallbackTitle(url){const bits=url.pathname.split('/').filter(Boolean);const slug=url.hostname.endsWith('myntra.com')&&bits.length>2?bits[2]:(bits.at(-1)==='buy'?bits.at(-3):bits.at(-1));return decode(decodeURIComponent(slug||'Saved product').replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())).slice(0,120)}
const headers={'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=900'};
exports.handler=async event=>{
 try{
  const raw=event.queryStringParameters?.url;if(!raw||raw.length>2500)return{statusCode:400,headers,body:JSON.stringify({error:'Missing/invalid link'})};
  const url=new URL(raw);if(url.protocol!=='https:'||url.username||url.password||!match(url.hostname.toLowerCase()))return{statusCode:422,headers,body:JSON.stringify({error:'Unsupported store'})};
  let page=url,response;
  for(let i=0;i<3;i++){
   response=await fetch(page,{redirect:'manual',signal:AbortSignal.timeout(7500),headers:{'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36','accept':'text/html,application/xhtml+xml','accept-language':'en-IN,en;q=0.9'}});
   if(response.status>=300&&response.status<400){const location=response.headers.get('location');if(!location)throw Error('redirect without location');page=new URL(location,page);if(page.protocol!=='https:'||!match(page.hostname.toLowerCase()))throw Error('unsafe redirect');continue}break
  }
  if(!response?.ok||!response.headers.get('content-type')?.includes('text/html'))throw Error('Store blocked the preview');
  const reader=response.body.getReader();const chunks=[];let length=0;while(length<850000){const {done,value}=await reader.read();if(done)break;chunks.push(Buffer.from(value));length+=value.length}await reader.cancel();const html=Buffer.concat(chunks).toString('utf8');
  if(/<title[^>]*>\s*(?:site maintenance|access denied|oops!)/i.test(html))throw Error('Store blocked preview');
  const meta=readMeta(html),p=productsFromJsonLd(html)[0]||{};
  const offer=Array.isArray(p.offers)?p.offers[0]:p.offers||{};
  let price=offer.price||offer.lowPrice||meta['product:price:amount']||meta['og:price:amount']||'';
  const currency=offer.priceCurrency||meta['product:price:currency']||meta['og:price:currency']||'INR';
  if(price)price=(currency==='INR'?'₹':currency+' ')+String(price).replace(/^[₹\s]+/,'');
  const images=cleanImages([...(Array.isArray(p.image)?p.image:[p.image]),meta['og:image'],meta['twitter:image']],page);
  const title=decode(p.name||meta['og:title']||meta['twitter:title']||html.match(/<title[^>]*>([^<]*)/i)?.[1]||fallbackTitle(url)).slice(0,120);
  const description=decode(p.description||meta.description||meta['og:description']).slice(0,300);
  return{statusCode:200,headers,body:JSON.stringify({title,description,price:String(price).slice(0,45),images,image:images[0]||'',vendor:page.hostname.replace(/^www\./,'')})};
 }catch(e){return{statusCode:502,headers,body:JSON.stringify({error:'Store unavailable for previews; product link can still be saved'})}}
};
