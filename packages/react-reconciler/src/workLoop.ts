import { scheduleMicroTask } from "hostConfig";
import { beginWork } from "./beginWork";
import { commitHookEffectListCreate, commitHookEffectListDestory, commitHookEffectListUnmount, commitMutaionEffects } from "./commitWork";
import { completeWork } from "./completeWork";
import { createWorkInProgress, FiberNode, FiberRootNode, PendingPassiveEffects } from "./fiber"
import { MutaionMark, NoFlags, PassiveEffect, PassiveMask } from "./fiberFlags";
import { getHighestPriorityLane, Lane, lanesToSchedulerPriority, markRootFinished, mergeLanes, Nolane, SyncLane } from "./fiberLanes";
import { flushSyncCallbacks, scheduleSyncCallback } from "./syncTaskQueue";
import { HostRoot } from "./workTags";
import {
  unstable_scheduleCallback as scheduleCallback,
  unstable_NormalPriority as NormalPriority,
  unstable_shouldYield,
  unstable_cancelCallback
} from 'scheduler'
import { useEffect } from "react";
import { HookHasEffect, Passive } from "./hookEffectTags";


//全局变量指向当前正在工作的fiberNode
let workInProgress: FiberNode | null = null;
//本次更新的Lane
let wipRootRenderLane: Lane = Nolane;


//Root退出的状态
type RootExitStatus = number;
//root还在执行中
const RootInComplete = 1;
//root执行完
const RootCompleted = 2;
//TODO 执行过程中报错了 的状态


/**
 * 标识useEffect的回调是否在执行，防止多次执行
 */
let rootDoesHasPassiveEffect: Boolean = false;

//将传入的fiber指向workInProgress
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  root.finishedLane = Nolane;
  root.finishedWork = null;
  workInProgress = createWorkInProgress(root.current, {})
  wipRootRenderLane = lane;
}

//调度功能
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  // TODO 调度功能

  //因为这里面传入得fiber除了首次渲染是fiberRootNode，后面得this.setState以及useState更新时都不是fiberRootNode
  //所以要向上遍历找到fiberRootNode
  const root = markUpdateFromFiberToRoot(fiber)

  //合并当前lanes
  markRootUpdated(root, lane);
  
  ensureRootIsScheduled(root) 

}

//调度阶段入口   保证root被调度
function ensureRootIsScheduled(root: FiberRootNode) {
  const updateLane = getHighestPriorityLane(root.pendingLanes);
  const existingCallback = root.callbackNode;

  //没有更新
  if (updateLane === Nolane) {
    if(existingCallback !== null){
      //取消回调
      unstable_cancelCallback(existingCallback);
    }
    root.callbackNode = null;
    root.callbackPriority = Nolane;
    return;
  }

  //调度后跟之前是同优先级，不需要开新的调度
  const curPriority = updateLane;
  const prevPriority = root.callbackPriority;
  
  if(curPriority === prevPriority){
    return;
  }

  //如果有更高优先级，需要将上次的回调给取消掉
  if(existingCallback !== null){
    unstable_cancelCallback(existingCallback);
  }


  let newCallbackNode = null;

  if (updateLane === SyncLane) {
    //同步优先级，用微任务调度
    if (__DEV__) {
      console.log('在微任务中调度，优先级', updateLane);
    }
    //形成调度队列  syncQueue=[performSyncWorkOnRoot,performSyncWorkOnRoot,performSyncWorkOnRoot,]
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
    //微任务中执行 ，虽然只执行一下，但是performSyncWorkOnRoot方法里面已经接收了三次的参数
    scheduleMicroTask(flushSyncCallbacks)
  } else {
    //其他优先级，用宏任务调度
    const schedulerPriority = lanesToSchedulerPriority(updateLane);
    //调度器用schedulerPriority优先级去执行performConcurrentWorkOnRoot.bind(null,root)
    newCallbackNode = scheduleCallback(schedulerPriority,performConcurrentWorkOnRoot.bind(null,root));
  } 
  root.callbackNode = newCallbackNode;
  root.callbackPriority = curPriority;
}




//本次更新的lane记录到FiberRootNode
function markRootUpdated(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

//遍历找到fiberRootNode节点,就是整个节点的顶级根节点
function markUpdateFromFiberToRoot(fiber: FiberNode) {
  let node = fiber;
  let parent = node.return;
  //在fiber结构中，只有hostRootNode没有return，它与fiberRootNode之间是通过 current,和 stateNode来连接得
  //在while中先找到hostRootFiber
  while (parent !== null) {
    node = parent;
    parent = node.return;
  }
  //再找到fiberRootNode
  if (node.tag === HostRoot) {
    return node.stateNode;
  }
  return null;
}

/**
 * 并发更新的渲染函数
 * @param root 
 * @param didTimeout 
 * @returns 
 */
function performConcurrentWorkOnRoot(root:FiberRootNode,didTimeout:boolean):any{
  //useEffect会触发更新，他的优先级可能很高，会打断当前的调度。所以再并发执行前，需要保证之前的Effect都被执行完
  //保证useEffect回调执行
  const curCallback = root.callbackNode;

  const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects);
  if(didFlushPassiveEffect){
    //再执行Effect回调时，可能触发更新，重新调度，需要检查两次的curCallback是否相同，不相同就返回null，取消本次的并发
    if(root.callbackNode !== curCallback){
      return null;
    }
  }
  const lane = getHighestPriorityLane(root.pendingLanes);
  const curCallbackNode = root.callbackNode;
  if(lane === Nolane){
    return null;
  }

  const needSync = lane === SyncLane || didTimeout;


  //render阶段  会返回root渲染退出的状态， 如果是2就是完成的状态 ，  1就是未完成的状态
  const exitStatus = renderRoot(root,lane,!needSync);

  ensureRootIsScheduled(root);//当前render退出后，重新调度（因为可能是来了一个优先级更高的调度）

  //位处状态是未结束的状态，就是1
  if(exitStatus === RootInComplete){
    //中断  
    if(root.callbackNode !== curCallbackNode){ //如果重新调度后callbackNode !== 本次被中断的curCallbackNode，表明调度是更高优先级的调度
      return null;
    }
    //如果重新调度后callbackNode === 本次被中断的curCallbackNode，则在一个时间节点继续执行，
    return performConcurrentWorkOnRoot.bind(null,root,)
  }
  //
  if(exitStatus === RootCompleted){
    const finishedWork = root.current.alternate;
    //将生成的fiberNOdetree挂载到root.finishedWork中
    root.finishedWork = finishedWork;

    //更新本次消费的lane
    root.finishedLane = lane;
    wipRootRenderLane = Nolane;
    // console.log("执行commit操作前的结果 root.finishedWork", root.finishedWork)
    //执行commit操作
    commitRoot(root);
  }else {
    if(__DEV__){
      console.log('还未实现并发更新结束状态');
    }
  }



}

/**
 * 执行同步渲染工作在FiberRootNode上
 * @param root ：FiberRootNode
 * @returns 
 */
function performSyncWorkOnRoot(root: FiberRootNode) {
  // console.log("root", root)
  const nextLane = getHighestPriorityLane(root.pendingLanes);
  if (nextLane !== SyncLane) {
    //其他比SyncLane低的优先级
    //Nolane
    ensureRootIsScheduled(root);
    return;
  }

  const exitStatus = renderRoot(root,nextLane,false);
  if(exitStatus === RootCompleted){
    const finishedWork = root.current.alternate;
    //将生成的fiberNOdetree挂载到root.finishedWork中
    root.finishedWork = finishedWork;

    //更新本次消费的lane
    root.finishedLane = nextLane;
    wipRootRenderLane = Nolane;
    // console.log("执行commit操作前的结果 root.finishedWork", root.finishedWork)
    //执行commit操作
    commitRoot(root);
  }else {
    if(__DEV__){
      console.log('还未实现同步更新结束状态');
    }
  }

  
}

/**
 * renderRoot开始渲染，进行worklooop，如果开启时间切片，则归进入并发workloop，否则就是同步workloop.
 * @param root 
 * @param lane 
 * @param shouldTimeSlice 
 * @returns 
 */
function renderRoot(root:FiberRootNode,lane:Lane, shouldTimeSlice:boolean){
  if(__DEV__){
    console.log(`开始${shouldTimeSlice ? '并发' : '同步'} 更新`);
  }

  //当优先级不同时才会初始化，如果优先级相同那就是中断在继续的过程
  if(wipRootRenderLane !== lane){
    //初始化操作 获取当前的workInProgress
    prepareFreshStack(root, lane);
  }

  //进入递归流程
  do {
    try {
      //执行workloop：如果开启了时间切片，就workLoopConcurrent，否则就workLoopSync
      shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
      break;//break,有以下几种情况 1：执行完了break。2：中断发生了执行的break. 3:出现异常break
    } catch (e) {
      if (__DEV__) {
        console.warn('workloop发生错误', e);
      }
      workInProgress = null;
    }
  } while (true)

  //下面是对中断执行的状态的判断
  /**
   * 开启了时间切片，同时工作还没不为空(没执行完)
   */
  if(shouldTimeSlice && workInProgress !== null){
    return RootInComplete;
  }
  //render阶段执行完
  if(!shouldTimeSlice && workInProgress !== null && __DEV__){
    console.log('render阶段结束时wip不应该不是null');
  }

  //TODO 报错的情况

  return RootCompleted;


}

/**
 * 主要作用是 1：
 * @param root 
 * @returns 
 */
function commitRoot(root: FiberRootNode) {
  const finishedWork = root.finishedWork;
  if (finishedWork === null) {
    return;
  }

  if (__DEV__) {
    console.warn('commit阶段开始', finishedWork)
  }
  const lane = root.finishedLane;
  if (lane === Nolane && __DEV__) {
    console.log('commit阶段finishedLane不应该是NoLane')
  }

  //重置
  root.finishedWork = null;
  root.finishedLane = Nolane;
  //移除已经消费的lane
  markRootFinished(root, lane);
  
  //判断当前这颗fiber树中是存在函数组件需要执行useEffect的回调的
  if (
    (finishedWork.flags & PassiveMask) !== NoFlags ||
    (finishedWork.subTreeFlags & PassiveMask) !== NoFlags
  ) {
    //防止多次commit时，多次调用effect
    if (!rootDoesHasPassiveEffect) {
      rootDoesHasPassiveEffect = true;
      //调度副作用    scheduleCallback是react下的scheduler提供的。  NormalPriority也是调度器提供的， 异步调度
      scheduleCallback(NormalPriority, () => {  //以NormalPriority这个优先级调度函数（）=>{}， 目前可以理解成在setTimeout中执行一个回调
        //执行副作用（回调）
        flushPassiveEffects(root.pendingPassiveEffects)
        return;
      })
    }
  }



  //判断是否存在三个子阶段需要执行的操作
  const subtreeHasEffext = (finishedWork.subTreeFlags & MutaionMark) != NoFlags;
  const rootHasEffect = (finishedWork.flags & MutaionMark) != NoFlags;

  if (subtreeHasEffext || rootHasEffect) {
    //beforeMutation

    //mutation   主要作用
    commitMutaionEffects(finishedWork, root)
    
    //将finishedWork这个生成的dom树挂载到finishedWork.stateNode,  然后将finishedWork挂载到root.current中
    root.current = finishedWork

    //layout
  } else {
    root.current = finishedWork
  }

  //重置
  rootDoesHasPassiveEffect = false;
  ensureRootIsScheduled(root);

}

/**
 * 本次更新的任何create回调都必须在所有上一次更新的destory回调执行完后再执行
 * @param pendingPassiveEffects 
 * @returns 返回的是didFlushPassiveEffect，标识当前是否有回调执行
 */
function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
  //标识当前是否有回调
  let  didFlushPassiveEffect = false;

  //执行流程: 先执行销毁的回调，在执行更新回调

  //遍历完所有useEffect中的卸载回调
  pendingPassiveEffects.unmount.forEach((effect) => {
    didFlushPassiveEffect = true;
    //Passive为useEffect中的回调执行
    commitHookEffectListUnmount(Passive, effect);
  });
  pendingPassiveEffects.unmount = [];

  //
  pendingPassiveEffects.update.forEach((effect) => {
    didFlushPassiveEffect = true;
    commitHookEffectListDestory(Passive | HookHasEffect, effect);
  });

  pendingPassiveEffects.update.forEach((effect) => {
    didFlushPassiveEffect = true;
    commitHookEffectListCreate(Passive | HookHasEffect, effect);
  });
  pendingPassiveEffects.update = [];
  //在回调中触发的更新，要继续处理
  flushSyncCallbacks();
  return  didFlushPassiveEffect;
}

//同步的workloop
function workLoopSync() {
  while (workInProgress !== null) {
    performUnitofWork(workInProgress);
  }
}

//并发的workloop
function workLoopConcurrent() {
  /**
   * unstable_shouldYield() 是否应该被中断
   */
  while (workInProgress !== null && !unstable_shouldYield()) {
    performUnitofWork(workInProgress);
  }
}

/**
 * beginWork的封装方法，里面也调用了completeWork的封装方法，同时workInProgress = next;
 * @param fiber =workInProgress
 */
function performUnitofWork(fiber: FiberNode) {

  const next = beginWork(fiber, wipRootRenderLane);
  fiber.memoizedProps = fiber.pendingProps;

  if (next === null) {
    // console.log("第一次执行complete操作的数据workInProgress", workInProgress)
    completeUnitofWork(fiber);
  } else {
    workInProgress = next;
  }
}

//completeWork的封装方法
function completeUnitofWork(fiber: FiberNode) {
  let node: FiberNode | null = fiber;
  do {
    //处理当前node
    completeWork(node);
    //处理右兄弟节点
    const sibling = node.sibling;
    if (sibling !== null) {
      workInProgress = sibling;
      return;
    }
    //向上遍历
    node = node.return;
    workInProgress = node;

  } while (node !== null)
}