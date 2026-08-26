import {McpServer} from '@modelcontextprotocol/server';
import {StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import {z} from 'zod';
import {HttpClient,clientError} from '../../../packages/client/src/http.js';
import {registerHost} from '../../../packages/client/src/host.js';
export const MCP_BUILD_IDENTITY=typeof __AUTOED_BUILD_IDENTITY__==='undefined'?null:__AUTOED_BUILD_IDENTITY__;
async function main(){
  if(!MCP_BUILD_IDENTITY)throw new Error('COMPILED_BUILD_REQUIRED');
  const args=process.argv.slice(2);if(args.shift()!=='--root')throw new Error('INVALID_REQUEST');const root=args.shift();if(args.shift()!=='--parent')throw new Error('INVALID_REQUEST');const parent=args.shift();
  let credentialId:string|undefined;if(args[0]==='--credential-id'){args.shift();credentialId=args.shift();if(!credentialId||!/^selfcheck-[0-9a-f-]{36}$/.test(credentialId))throw new Error('INVALID_REQUEST');}if(!root||!parent||args.length)throw new Error('INVALID_REQUEST');
  const client=new HttpClient(root,parent,'mcp',MCP_BUILD_IDENTITY,credentialId);
  await registerHost(root,parent,MCP_BUILD_IDENTITY,credentialId);
  const server=new McpServer({name:'autoed',version:MCP_BUILD_IDENTITY.version});
  const component=(healthy:boolean)=>({role:'mcp',build:MCP_BUILD_IDENTITY,checkedAt:new Date().toISOString(),health:healthy?'healthy':'error',evidence:healthy?'authenticated_probe':'process_report'});
  const result=async(run:()=>Promise<unknown>)=>{try{const value=await run();const output=value as Record<string,unknown>;return {content:[{type:'text' as const,text:JSON.stringify(output)}],structuredContent:output};}catch(error){const output={...clientError(error),component:component(false)};return {isError:true,content:[{type:'text' as const,text:JSON.stringify(output)}],structuredContent:output};}};
  server.registerTool('autoed_status',{inputSchema:z.strictObject({})},async()=>result(async()=>({component:component(true),status:await client.status()})));
  server.registerTool('autoed_selftest',{inputSchema:z.strictObject({kind:z.enum(['echo','digest']),value:z.string().max(4096),idempotencyKey:z.uuid().optional()})},async args=>result(()=>client.selftest(args.kind,args.value,args.idempotencyKey)));
  server.registerTool('autoed_job_get',{inputSchema:z.strictObject({jobId:z.uuid()})},async args=>result(()=>client.job(args.jobId)));
  await server.connect(new StdioServerTransport());
}
void main().catch(error=>{process.stderr.write(JSON.stringify(clientError(error))+'\n');process.exitCode=1;});
