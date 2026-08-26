import {discoverClientEndpoint,isNativeClientEndpoint} from '../../platform/src/client-endpoint.js';
export function discover(root:string,parent:string){return discoverClientEndpoint({root,parent,excludedRoots:[]});}
export const isDiscoveredEndpoint=isNativeClientEndpoint;
