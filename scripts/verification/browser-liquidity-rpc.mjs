import { createServer } from 'node:http';
import { encodeAbiParameters, keccak256, stringToBytes } from 'viem';

const selector = (signature) => keccak256(stringToBytes(signature)).slice(0, 10);
const replies = new Map([
  [selector('version()'), encodeAbiParameters([{ type: 'string' }], ['2.4.0'])],
  [selector('minBetWei()'), encodeAbiParameters([{ type: 'uint256' }], [10n ** 16n])],
  [selector('getMarketCount()'), encodeAbiParameters([{ type: 'uint256' }], [205n])],
]);
createServer(async (request, response) => {
  if (request.method !== 'POST') { response.writeHead(405); response.end(); return; }
  let body = '';
  for await (const chunk of request) body += chunk;
  const call = JSON.parse(body);
  const answer = (item) => {
    let result;
    if (item.method === 'eth_chainId') result = '0x4cef52';
    else if (item.method === 'eth_blockNumber') result = '0x3e8';
    else if (item.method === 'eth_call') result = replies.get(item.params[0].data.slice(0, 10));
    if (result === undefined) return { jsonrpc: '2.0', id: item.id, error: { code: -32601, message: `Unsupported fixture method ${item.method}` } };
    return { jsonrpc: '2.0', id: item.id, result };
  };
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify(Array.isArray(call) ? call.map(answer) : answer(call)));
}).listen(3012, '127.0.0.1', () => console.log('Browser fixture RPC listening on 127.0.0.1:3012'));
