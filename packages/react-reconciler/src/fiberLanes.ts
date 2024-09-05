//数字越小优先级越高
//还有一个优先级是unstable_LowPriority  低优先级  4
import {
  unstable_getCurrentPriorityLevel,
  unstable_IdlePriority, //空闲时的优先级   5
  unstable_ImmediatePriority, //同步更新优先级  1
  unstable_NormalPriority, //正常优先级   3
  unstable_UserBlockingPriority //点击事件就是这个优先级   2    
} from 'scheduler';

import { FiberRootNode } from "./fiber";

export type Lane = number;
export type Lanes = number;

//越小优先级越高
export const SyncLane = 0b00001;//同步优先级
export const Nolanes = 0b00000;//
export const Nolane = 0b00000;//
export const InputContinuousLane = 0b00010; //连续输入的优先级
export const DefaultLane = 0b00100; //默认优先级
export const TransitionLane = 0b01000; //useTransition对应的优先级
export const IdleLane = 0b10000; //空闲优先级

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
  return laneA | laneB;
}
/**
 * 请求一个更新的优先级，从上下文环境钟获取Scheduler优先级，然后转换为lane模型的优先级
 * @returns 返回一个优先级
 */
export function requestUpdateLane() {
  // 从上下文环境钟获取Scheduler优先级
  const currentSchedulerPriority = unstable_getCurrentPriorityLevel();
  //将Scheduler优先级转化为react中lane模型的优先级
  const lane = schedulerPriorityToLane(currentSchedulerPriority);
  return lane;
}

/**
 * 比较优先级是否足够，通过取交集的方式
 * @param set 
 * @param subset 
 * @returns 
 */
export function isSubsetOfLanes(set: Lanes, subset: Lane) {
  return (set & subset) === subset;
}


//返回优先级最高的lane
export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes;
}

//移除lane
export function markRootFinished(root: FiberRootNode, lane: Lane) {
  root.pendingLanes &= ~lane;
}

/**
 * scheduler的优先级转换为lane模型的优先级
 * @param schedulerPriority 
 * @returns 
 */
export function schedulerPriorityToLane(schedulerPriority: number): Lane {
  if (schedulerPriority === unstable_ImmediatePriority) {
    return SyncLane;
  }
  if (schedulerPriority === unstable_UserBlockingPriority) {
    return InputContinuousLane;
  }
  if (schedulerPriority === unstable_NormalPriority) {
    return DefaultLane;
  }
  return Nolane;
}

/**
 * lane模型的优先级转换为scheduler调度器的优先级
 * @param lanes 
 * @returns 
 */
export function lanesToSchedulerPriority(lanes: Lanes) {
  const lane = getHighestPriorityLane(lanes);

  if (lane === SyncLane) {
    return unstable_ImmediatePriority;
  }
  if (lane === InputContinuousLane) {
    return unstable_UserBlockingPriority;
  }
  if (lane === DefaultLane) {
    return unstable_NormalPriority;
  }
  return unstable_IdlePriority;
}
