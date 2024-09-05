import { ReactElementType } from "shared/ReactType";
import { FiberNode } from "./fiber"
import { processUpdateQueue, UpdateQueue } from "./updateQueue";
import { Fragment, FunctionComponent, HostComponent, HostRoot, HostText } from "./workTags"
import { recocnileChildFibers, mountChildFibers } from './childFibers'
import { renderWithHooks } from "./fiberHooks";
import { Lane } from "./fiberLanes";
//beginwork自上而下， 逐层地根据element创建对应的Fiber节点
//递归中的递阶段
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
  // console.log("beginWork wip", wip)
  //比较，返回子fiberNode
  switch (wip.tag) {
    case HostRoot: 
      return updateHostRoot(wip, renderLane);
    case HostComponent:
      return updateHostComponent(wip);
    case HostText: //文本节点，没有子节点
      return null;
    case FunctionComponent:
      return updateFunctionComponent(wip, renderLane)
    case Fragment:
      return updateFromMap(wip);
    default:
      if (__DEV__) {
        console.log('beginwork未实现得类型')
      }
      break;
  }
  return null;
};

function updateFromMap(wip: FiberNode) {
  const nextChildren = wip.pendingProps
  recocnileChildren(wip, nextChildren);
  return wip.child;
}

//生成function组件的fiber树
function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
  // console.log("updateFunctionComponent", wip)

  //对于函数组件，他的children就是函数组件的执行结果
  const nextChildren = renderWithHooks(wip, renderLane)

  // console.log("renderWithHooks nextChildren", nextChildren)
  recocnileChildren(wip, nextChildren);
  
  return wip.child;
}

function updateHostRoot(wip: FiberNode, renderLane: Lane) {
  // console.log("updateHostRoot操作,参数为wip", wip);
  const baseState = wip.memoizedState;
  const updateQueue = wip.updateQueue as UpdateQueue<Element>
  const pending = updateQueue.shared.pending;
  // console.log("beginWork", baseState)
  // console.log("beginWork", updateQueue)
  // console.log("beginWork", pending)
  updateQueue.shared.pending = null;
  //执行状态的更新
  const { memoizedState } = processUpdateQueue(baseState, pending, renderLane);
  wip.memoizedState = memoizedState;


  const nextChildren = wip.memoizedState; 
  //这里有问题
  recocnileChildren(wip, nextChildren);
  return wip.child;
}



function updateHostComponent(wip: FiberNode) {
  // console.log("updateHostComponent操作,参数为wip", wip);
  const nextProps = wip.pendingProps;
  const nextChildren = nextProps.children;
  // console.log("updateHostComponent操作,app的孩子", nextChildren);
  recocnileChildren(wip, nextChildren);
  return wip.child;
}


function recocnileChildren(wip: FiberNode, children?: ReactElementType) {
  const current = wip.alternate;

  if (current !== null) {
    //update
    wip.child = recocnileChildFibers(wip, current?.child, children)
  } else {
    wip.child = mountChildFibers(wip, null, children)
    //mount 
  }
}