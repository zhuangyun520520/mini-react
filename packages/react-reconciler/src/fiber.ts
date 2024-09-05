import { Props, Key, Ref, ReactElementType } from "../../shared/ReactType";
import { FunctionComponent, HostComponent, WorkTag, Fragment } from "./workTags";
import { Flags, NoFlags, Placement, Update, ChildDeletion } from "./fiberFlags";
import { Container } from "hostConfig";
import { Lane, Lanes, Nolane, Nolanes } from "./fiberLanes";
import { Effect } from "./fiberHooks";
import { CallbackNode } from "scheduler";

export class FiberNode {
  type: any;
  tag: WorkTag;
  pendingProps: Props;
  key: Key;
  stateNode: any;

  return: FiberNode | null;
  sibling: FiberNode | null;
  child: FiberNode | null;
  index: number;

  ref: Ref
  memoizedProps: Props | null;
  memoizedState: any; //在hooks中，将被用来指向hooks的链表
  alternate: FiberNode | null;
  flags: Flags
  subTreeFlags: Flags

  updateQueue: unknown
  //当前节点下要删除的节点
  deletions: FiberNode[] | null

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    //实例属性
    this.tag = tag;
    this.key = key || null;
    this.stateNode = null;
    this.type = null;

    //构成树状结构
    this.return = null;
    this.sibling = null;
    this.child = null;
    this.index = 0;

    this.ref = null;

    //作为工作单元的属性
    this.pendingProps = pendingProps;
    this.memoizedProps = null;
    this.updateQueue = null;
    this.memoizedState = null;


    this.alternate = null;

    //副作用（标识当前FiberNode是插入还是更新）
    this.flags = NoFlags
    this.subTreeFlags = NoFlags

    this.deletions = null
  }
}

//保存的unmount回调函数和update回调函数
export interface PendingPassiveEffects {
  unmount: Effect[];
  update: Effect[];
}


//FierRootNode类  用来保存通用信息
export class FiberRootNode {
  container: Container;
  current: FiberNode;
  finishedWork: FiberNode | null; //完成更新的递归流程的hostRootFiber（rootfiber）
  pendingLanes: Lanes;//所有还未被消费的lane的集合
  finishedLane: Lane;//本次更新消费的lane
  pendingPassiveEffects: PendingPassiveEffects;  //用于保存useEffect的两个回调一个是update 一个unmount

  callbackNode: CallbackNode | null;
  callbackPriority: Lane;

  constructor(container: Container, hostRootFiber: FiberNode) {
    this.container = container;
    this.current = hostRootFiber;
    hostRootFiber.stateNode = this
    this.finishedWork = null
    this.pendingLanes = Nolanes;
    this.finishedLane = Nolane
    this.pendingPassiveEffects = {
      unmount: [],
      update: []
    }
    this.callbackNode = null;
    this.callbackPriority = Nolane;
  }
}

//创建一个workInProgress(也是创建一个FiberNode)
export const createWorkInProgress = (current: FiberNode, pendingProps: Props): FiberNode => {
  let wip = current.alternate;

  // console.log("创建WorkInProgress时传进来的root.current.alternate为", wip)
  if (wip === null) {
    //mount
    wip = new FiberNode(current.tag, pendingProps, current.key);

    wip.stateNode = current.stateNode;

    wip.alternate = current;
    current.alternate = wip;
  } else {
    //update
    //清除上次更新遗留的信息
    wip.pendingProps = pendingProps;
    wip.flags = NoFlags;
    wip.subTreeFlags = NoFlags;
    wip.deletions = null;
  }
  wip.type = current.type;
  wip.updateQueue = current.updateQueue;
  wip.child = current.child;

  wip.memoizedProps = current.memoizedProps;
  wip.memoizedState = current.memoizedState;
  // console.log("创建的WorkInProgress", wip)
  return wip;
}


//通过给定一个element创建一个fiber
export function createFiberFromElement(element: ReactElementType): FiberNode {
  const { type, key, props } = element;
  let fiberFlags: WorkTag = FunctionComponent;

  if (typeof type === 'string') {
    //<div/> type:'div'
    fiberFlags = HostComponent;
  } else if (typeof type === 'function' && __DEV__) {
    console.warn('未定义得type类型', element)
  }

  const fiber = new FiberNode(fiberFlags, props, key)
  fiber.type = type;
  return fiber;
}


export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
  const fiber = new FiberNode(Fragment, elements, key);
  return fiber;
}