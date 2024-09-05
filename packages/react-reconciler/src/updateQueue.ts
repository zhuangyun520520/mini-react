import { Dispatch } from "react/src/currentDispatcher";
import { Action } from "../../shared/ReactType";
import { Update } from "./fiberFlags";
import {isSubsetOfLanes, Lane, Nolane } from "./fiberLanes";

//update的数据结构
export interface Update<State> {
  //触发更新的行为
  action: Action<State>;
  lane:Lane;
  next: Update<any> | null;
}

//创建update
export const createUpdate = <State>(action: Action<State>,lane:Lane): Update<State> => {
  return {
    action,
    lane,
    next: null
  };
}

//定义updatequeue的结构
export interface UpdateQueue<State> {
  shared: {
    pending: Update<State> | null;
  }
  dispatch: Dispatch<State> | null;
}

//创建updatequeue
export const createUpdateQueue = <State>() => {
  return {
    shared: {
      pending: null
    },
    dispatch: null
  } as UpdateQueue<State>
};

//将update插入updatequeue中
export const enqueueUpdate = <State>(
  updateQueue: UpdateQueue<State>,
  update: Update<State>
) => {
  const pending = updateQueue.shared.pending;
	if (pending === null) {
		// pending = a -> a
		update.next = update; 
	} else {
		// pending = b -> a -> b
		// pending = c -> a -> b -> c
		update.next = pending.next;
		pending.next = update;
	}
  updateQueue.shared.pending = update;
  // console.log("添加更新之后的hostRootFiber.updateQueue.shared.pending", updateQueue.shared.pending)
}


//消费update方法
export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null,
  renderLane:Lane
): { memoizedState: State;
    baseState:State;
    baseQueue:Update<State> | null
 } => {

  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState,
    baseState,
    baseQueue: null
  }

  if (pendingUpdate !== null) {
    //第一个update
    //baseState 1 update 2 -> memoizedState 2
    //baseState 1 update (x)=> 4x  -> memoizedState 4
    let first = pendingUpdate.next;
    let pending = pendingUpdate.next as Update<any>;
    /**
     * newBaseState 是 baseState  
     * newState 是 memoizedState  ,memoizedState是优先级优先计算下来的值
     */
    let newBaseState = baseState;
    let newBaseQueueFirst:Update<State> | null = null;
    let newBaseQueueLast:Update<State> | null = null;
    let newState= baseState;


    do{
      const updateLane = pending.lane;
      
      if(!isSubsetOfLanes(renderLane,updateLane)){
        //优先级不够, 被跳过

        //克隆当前被跳过的update
        const clone = createUpdate(pending.action,pending.lane)

        //是不是第一个被跳过的update   newBaseQueueFirst存放的是被跳过的第一个update和它后买你的update
        if(newBaseQueueFirst === null){
          newBaseQueueFirst = clone;
          newBaseQueueLast = clone;
          baseState = newState;
        }else {
          (newBaseQueueLast as Update<State>).next = clone;
          newBaseQueueLast = clone;

        }

      }else {
        //优先级足够
        if(newBaseQueueLast !== null){
          //newBaseQueueLast不为空，说明已经存在第一个被跳过的update，其后所有的update都要添加到BaseQueue中
          const clone = createUpdate(pending.action,Nolane);
          (newBaseQueueLast as Update<State>).next = clone;
          newBaseQueueLast = clone;

        }
 
        const action = pending.action;
        if (action instanceof Function) {
          //baseState 1 update (X)=>4x ->memoizedState 4
          newState = action(baseState)
        } else {
          //baseState 1 update 2 ->memoizedState 2
          newState = action
        }
      }

      pending = pending.next as Update<any>;

    }while(pending !== first)
    
    if(newBaseQueueLast === null){
      //本次计算没有update被跳过
      newBaseState = newState;
    }else {
      newBaseQueueLast.next = newBaseQueueFirst;
    }

    result.memoizedState = newState;
    result.baseState = newBaseState;
    result.baseQueue = newBaseQueueLast;
    
  }
  
  return result;
}