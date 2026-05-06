(function (global) {
  var state = { nodes: [], edges: [], memory: {} };
  function addNode(node) { state.nodes.push(node); }
  function connect(from, to) { state.edges.push({ from: from, to: to }); }
  function getNext(nodeId) { return state.edges.filter(function (e) { return e.from === nodeId; }).map(function (e) { return e.to; }); }
  function reset() { state.nodes = []; state.edges = []; }
  function run(input) { var current = state.nodes[0], data = input, seen = {}; while (current && !seen[current.id]) { seen[current.id] = true; data = typeof current.execute === 'function' ? current.execute(data) : data; var nextIds = getNext(current.id); current = state.nodes.find(function (n) { return n.id === nextIds[0]; }); } return data; }
  global.LogicHubFlowEngine = { state: state, addNode: addNode, connect: connect, getNext: getNext, run: run, reset: reset };
})(window);
  function run(input) { var current = state.nodes[0], data = input; while (current) { data = current.execute(data); var nextIds = getNext(current.id); current = state.nodes.find(function (n) { return n.id === nextIds[0]; }); } return data; }
  global.LogicHubFlowEngine = { state: state, addNode: addNode, connect: connect, getNext: getNext, run: run, reset: reset };
})(window);
  function run(input) { var current = state.nodes[0], data = input; while (current) { data = current.execute(data); var nextIds = getNext(current.id); current = state.nodes.find(function (n) { return n.id === nextIds[0]; }); } return data; }
  global.LogicHubFlowEngine = { state: state, addNode: addNode, connect: connect, getNext: getNext, run: run };
})(window);
export const state={nodes:[],edges:[],memory:{}};
export function addNode(node){state.nodes.push(node);}
export function connect(from,to){state.edges.push({from,to});}
export function getNext(nodeId){return state.edges.filter(function(e){return e.from===nodeId;}).map(function(e){return e.to;});}
export function run(input){var current=state.nodes[0],data=input;while(current){data=current.execute(data);var nextIds=getNext(current.id);current=state.nodes.find(function(n){return n.id===nextIds[0];});}return data;}
