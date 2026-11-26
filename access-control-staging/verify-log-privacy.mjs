// Check only non-secret settings; never print the API response or token.
import assert from 'node:assert/strict';
const token=process.env.CLOUDFLARE_API_TOKEN;
assert.ok(token,'staging token unavailable');
const url='https://api.cloudflare.com/client/v4/accounts/3c4291ea6933452f275090a2819b25e9/workers/scripts/engineering-tools-access-staging/script-settings';
let settings;
for(let n=0;n<5;n++){
  const response=await fetch(url,{headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Unable to inspect staging observability settings: HTTP '+response.status);
  const body=await response.json();
  if(!body.success)throw Error('Unable to inspect staging observability settings');
  settings=body.result?.observability?.logs;
  if(settings?.enabled===true && settings?.invocation_logs===true && settings?.redact_query_string===true)break;
  await new Promise(resolve=>setTimeout(resolve,1500));
}
assert.equal(settings?.enabled,true,'Worker logs must remain enabled');
assert.equal(settings?.invocation_logs,true,'invocation logs must remain enabled');
assert.equal(settings?.redact_query_string,true,'URL query strings must be redacted');
console.log('PASS: invocation logs remain enabled and URL query strings are redacted.');
