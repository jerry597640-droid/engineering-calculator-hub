// TEST DEPLOYMENT ONLY. See README before any production use.
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';
import { route } from './web-app.mjs';

export default {
  async fetch(request, env) {
    const noStore={'cache-control':'private, no-store, max-age=0','x-content-type-options':'nosniff'};
    try {
      const origin=new URL(request.url).origin;
      // Never construct redirects or cookies using an unapproved host header.
      if(!env.SITE_ORIGIN || origin!==env.SITE_ORIGIN || !origin.startsWith('https://'))return new Response('Unavailable',{status:503,headers:noStore});
      if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(env.SUPABASE_URL||'') || !(env.SUPABASE_PUBLISHABLE_KEY||'').startsWith('sb_publishable_'))return new Response('Unavailable',{status:503,headers:noStore});
      const pending=[];
      const client=createServerClient(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY,{
        cookieOptions:{name:'__Host-ech-auth',path:'/',secure:true,httpOnly:true,sameSite:'lax'},
        cookies:{
          getAll(){return parseCookieHeader(request.headers.get('Cookie')||'')},
          setAll(items){for(const c of items)pending.push(c)}
        }
      });
      const result=await route(request,{client,assets:env.ASSETS});
      const h=new Headers(result.headers);
      h.set('cache-control','private, no-store, max-age=0');
      h.set('pragma','no-cache'); h.set('expires','0');
      for(const {name,value,options} of pending){
        const clean={...options,path:'/',secure:true,httpOnly:true,sameSite:'lax'};delete clean.domain;
        h.append('set-cookie',serializeCookieHeader(name,value,clean));
      }
      return new Response(result.body,{status:result.status,statusText:result.statusText,headers:h});
    } catch {
      // Do not leak identifiers, tokens, passwords, or upstream error messages.
      return new Response('Service temporarily unavailable',{status:503,headers:noStore});
    }
  }
};
