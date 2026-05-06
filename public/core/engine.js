export const state={nodes:[],edges:[],memory:{}};
export function addNode(node){state.nodes.push(node);}
export function connect(from,to){state.edges.push({from,to});}
export function getNext(nodeId){return state.edges.filter(function(e){return e.from===nodeId;}).map(function(e){return e.to;});}
export function run(input){var current=state.nodes[0],data=input;while(current){data=current.execute(data);var nextIds=getNext(current.id);current=state.nodes.find(function(n){return n.id===nextIds[0];});}return data;}
