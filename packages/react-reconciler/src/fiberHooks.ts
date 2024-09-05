
import internals from "shared/internals";
import { FiberNode } from "./fiber";
import { Dispatcher } from "react/src/currentDispatcher";
// import { Dispatch, memo } from "react";
import { Dispatch } from "react/src/currentDispatcher";
import { createUpdate, createUpdateQueue, enqueueUpdate, processUpdateQueue, Update, UpdateQueue } from "./updateQueue";
import { Action } from "shared/ReactType";
import { scheduleUpdateOnFiber } from "./workLoop";
import { Lane, Nolane, requestUpdateLane } from "./fiberLanes";
import { Flags, PassiveEffect } from "./fiberFlags";
import { HookHasEffect, Passive } from "./hookEffectTags";
import { useEffect } from "react";

//beginwork阶段调用

//定义一个全局变量，指定当前正在render的函数组件对应的fiberNode（不是当前的那颗fibernode树）,
let currentRenderingFiber: FiberNode | null = null;

//当前正在处理的hook，因为当前的fiber可能有多个hook
let workInProgressHook: Hook | null = null;

//current(当前页面的fibernode树)下的hook
let currentHook: Hook | null = null;

const { currentDispatcher } = internals;

let renderLane: Lane = Nolane;

//定义hook的数据结构
interface Hook {
  memoizedState: any;//保存了该hook自身的数据
  updateQueue: unknown;
  next: Hook | null;//指向下一个hook
  baseState: any;
  baseQueue: Update<any> | null;
}

//Effect的结构，useEffect是其中之一
export interface Effect {
  tag: Flags;
  create: EffectCallback | void;
  destory: EffectCallback | void;
  deps: EffectDeps;
  next: Effect | null; //指向下一个useEffect类型的hook里面 memoiezdState（memoiezdState存放的是useEffect），并不是hook里面的next ，ps 15/1  10:46
}


type EffectCallback = () => void;
type EffectDeps = any[] | null;


//定义一个FC组件的updateQueue，里面存放了当前组件的effect的最后一个
export interface FCUpdateQueue<State> extends UpdateQueue<State> {
  lastEffect: Effect | null;
}

/**
 * 执行function组件的方法  返回的是函数组件的返回值，是一个ReactElementType
 * @param wip 
 * @param lane 
 * @returns 
 */
export function renderWithHooks(wip: FiberNode, lane: Lane) {
  //记录当前的render的fiber
  currentRenderingFiber = wip;
  //也算是一种重置
  wip.memoizedState = null;
  //重置effect链表
  wip.updateQueue = null;

  renderLane = lane;
  const current = wip.alternate;
  console.log("更新操作后的current", current)

  if (current !== null) {
    //update
    //指定在update时，内部数据共享层的使用的hooks集合
    //这一步会生成
    currentDispatcher.current = HooksDispatcherOnUpdate;
  } else {
    //mount  生成useState的dispatcher,当回调函数中去执行dispatcher时，会将action加入到hook的updateQueue中，然后调用scheduleUpdateOnFiber(),触发更新
    //触发更新后,就会走到上面的update中，去执行刚加入updateQueue的action。
    currentDispatcher.current = HooksDispatcherOnMount;
  }

  // 执行函数组件，获取return当作children返回
  const Component = wip.type;
  const props = wip.pendingProps;
  const children = Component(props);
  
  //重置操作
  currentRenderingFiber = null;
  renderLane = Nolane;
  return children;
}



const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState,
  useEffect: mountEffect
};

const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
  useEffect: updateEffect

};

useEffect(()=>{
  console.log(11111);
  return ()=>{
    console.log(2222);
  }
},[])

function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  //给currentRenderingFiber标记副作用
  (currentRenderingFiber as FiberNode).flags |= PassiveEffect;
  //pushEffect():将useEffect里面的回调添加到当前渲染的fiber的更新队列中，然后等待调度去执行
  //hook.memoizedState = pushEffect():生成一个useEffect Hook,存放在当前fiberNode的memoizedState下的hook链表中
  hook.memoizedState = pushEffect(Passive | HookHasEffect, create, undefined, nextDeps);
  // console.log("hook.memoizedState", hook.memoizedState)
}

function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;

  let destory: EffectCallback | void;

  if (currentHook !== null) {
    const preEffect = currentHook.memoizedState as Effect;
    destory = preEffect.destory;

    if (nextDeps !== null) {
      //浅比较依赖
      const preDeps = preEffect.deps;
      //相等不执行副作用
      if (areHookInputEqual(nextDeps, preDeps)) {
        hook.memoizedState = pushEffect(Passive, create, destory, nextDeps);
        return;
      }
    }
    //浅比较后不相等   才会执行副作用
    (currentRenderingFiber as FiberNode).flags |= PassiveEffect;
    hook.memoizedState = pushEffect(Passive | HookHasEffect, create, destory, nextDeps);
  }



  (currentRenderingFiber as FiberNode).flags |= PassiveEffect;
  
  hook.memoizedState = pushEffect(Passive | HookHasEffect, create, undefined, nextDeps);
}

//浅比较依赖
function areHookInputEqual(nextDeps: EffectDeps, preDeps: EffectDeps) {
  if (preDeps === null || nextDeps === null) {
    return false;
  }

  for (let i = 0; i < preDeps.length && i < nextDeps.length; i++) {
    if (Object.is(preDeps[i], nextDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}

/**
 * 将effect用effect里面的next收集起来.
 * @param hookFlags 
 * @param create 
 * @param destory 
 * @param deps 
 * @returns 
 */
function pushEffect(
  hookFlags: Flags,
  create: EffectCallback | void,
  destory: EffectCallback | void,
  deps: EffectDeps
): Effect {
  const effect: Effect = {
    tag: hookFlags,
    create,
    destory,
    deps,
    next: null
  }

  const fiber = currentRenderingFiber as FiberNode;
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
  if (updateQueue === null) {
    const updateQueue = createFCUpdateQueue();

    fiber.updateQueue = updateQueue;

    effect.next = effect;
    updateQueue.lastEffect = effect;
  } else {
    //插入effect
    const lastEffect = updateQueue.lastEffect;
    if (lastEffect === null) {
      effect.next = effect;
      updateQueue.lastEffect = effect;
    } else {
      const firstEffect = lastEffect.next;
      lastEffect.next = effect;
      effect.next = firstEffect;
      updateQueue.lastEffect = effect;
    }
  }
  return effect;
}

//创建一个FC的updateQueue
function createFCUpdateQueue<State>() {
  const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
  updateQueue.lastEffect = null;
  return updateQueue;
}

/**
 * useState再update时的调用
 * @returns 
 */
function updateState<State>(): [State, Dispatch<State>] {
  //找到当前useState对应的hook数据    
  const hook = updateWorkInProgressHook();

  //计算新State的逻辑
  const queue = hook.updateQueue as UpdateQueue<State>;

  const baseState = hook.baseState;

  const pending = queue.shared.pending;
  const current = currentHook as Hook;
  let baseQueue = current.baseQueue;

  //重置，防止干预下次更新
  queue.shared.pending = null;

  if (pending !== null) {
    //如果pending baseQueue  update保存再current中
    if (baseQueue !== null) {
      //如果baseQueue不为空， 合并baseQueue和pending
      const baseFirst = baseQueue.next;
      const pendingFirst = pending.next;

      baseQueue.next = pendingFirst;
      pending.next = baseFirst;
    }

    baseQueue = pending;
    //合并baseQueue和pending后的baseQueue,保存在current中，这是为了中断丢失pendin
    current.baseQueue = pending;
    queue.shared.pending = null;

  }
  
  if (baseQueue !== null) {
    const {
      memoizedState,
      baseQueue: newBaseQueue,
      baseState: newBaseState
    } = processUpdateQueue(
      baseState,
      baseQueue,
      renderLane);
    hook.memoizedState = memoizedState;
    hook.baseQueue = newBaseQueue;
    hook.baseState = newBaseState;
  }

  return [hook.memoizedState, queue.dispatch as Dispatch<State>]
}



function mountState<State>(
  initialState: (() => State) | State
): [State, Dispatch<State>] {
  // console.log("mountState执行了", initialState)
  //找到当前useState对应的hook数据,   对workInProgressHook进行处理，最后返回workInProgressHook
  const hook = mountWorkInProgressHook();

  //得到返回结果的的第一个数据
  let memoizedState;
  if (initialState instanceof Function) {
    memoizedState = initialState();
  } else {
    memoizedState = initialState;
  }

  //返回结果的第二个数据
  const queue = createUpdateQueue<State>();
  hook.updateQueue = queue;
  hook.memoizedState = memoizedState;
  hook.baseState = memoizedState;
  //@ts-ignore       
  const dispatch = dispatchSetState.bind(null, currentRenderingFiber, queue);
  queue.dispatch = dispatch;
  return [memoizedState, dispatch]
}

function dispatchSetState<State>(
  fiber: FiberNode,
  updateQueue: UpdateQueue<State>,
  //x | (x)->4x
  action: Action<State>
) {
  const lane = requestUpdateLane();
  const update = createUpdate(action, lane);
  enqueueUpdate(updateQueue, update);
  scheduleUpdateOnFiber(fiber, lane)
}

//根据current fiberNode的hook，获取workInProgress的hook,就相当于复制
function updateWorkInProgressHook(): Hook {
  //TODO render阶段触发的更新

  //下面是在回调中触发的useState中dispatcher更新

  //保存下一个hook
  let nextCurrentHook: Hook | null;

  if (currentHook === null) {
    //这是这个FC update时的第一个hook
    //这里的currnent为当前页面的fiber
    const currnent = currentRenderingFiber?.alternate;
    if (currnent !== null) {
      nextCurrentHook = currnent?.memoizedState
    } else {
      //mount时
      nextCurrentHook = null;
    }
  } else {
    //这是这个FC update时的后续的hook
    nextCurrentHook = currentHook.next;
  }

  if (nextCurrentHook === null) {
    //针对if条件里面的useState
    throw new Error(`组件${currentRenderingFiber?.type}本次执行时的hook比上次多`);
  }

  currentHook = nextCurrentHook as Hook;
  const newHook: Hook = {
    memoizedState: currentHook.memoizedState,
    updateQueue: currentHook.updateQueue,
    next: null,
    baseQueue: currentHook.baseQueue,
    baseState: currentHook.baseState
  }
  if (workInProgressHook === null) {
    //update时，第一个hook
    if (currentRenderingFiber === null) {
      throw new Error("请在函数组件中使用hook")
    } else {
      workInProgressHook = newHook;
      currentRenderingFiber.memoizedState = workInProgressHook;
    }
  } else {
    // update 时，后续的hook
    workInProgressHook.next = newHook;
    workInProgressHook = newHook;
  }
  return workInProgressHook;
}

/**
 * 创建一个hook，给他挂载到currentRenderingFiberd的memoizedState的hooks链表的next
 * @returns 返回一个workInProgressHook，workInProgressHook既当前正在处理的hook
 */
function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,
    updateQueue: null,
    next: null,
    baseQueue: null,
    baseState: null
  }

  if (workInProgressHook === null) {
    //mount时，第一个hook
    if (currentRenderingFiber === null) {
      throw new Error("fiberHooks文中中  请在函数组件中使用hook")
    } else {
      workInProgressHook = hook;
      currentRenderingFiber.memoizedState = workInProgressHook;
    }
  } else {
    // mount 时，后续的hook
    workInProgressHook.next = hook;
    workInProgressHook = hook;
  }
  return workInProgressHook;
}