//同步队列
let syncQueue: ((...args: any) => void)[] | null = null;

//当前是否正在执行同步队列
let isFlushingSyncQueue = false;

/**
 * 将回调函数添加到同步队列中
 * @param callback 需要加入同步队列的回调
 */
export function scheduleSyncCallback(callback: (...args: any) => void) {
  // console.log('进入scheduleSyncCallback的调度同步任务')
  //syncQueue分情况处理
  if (syncQueue === null) {
    syncQueue = [callback]
  } else {
    syncQueue.push(callback);
  }
  // console.log("syncQueue", syncQueue)
}

/**
 * 执行同步队列里面的回调
 */
export function flushSyncCallbacks() {
  if (!isFlushingSyncQueue && syncQueue) {
    isFlushingSyncQueue = true;
    try {
      syncQueue.forEach((callback) => callback());
    } catch (e) {
      console.log('flushSyncCallbacks报错', e)
    } finally {
      isFlushingSyncQueue = false;

      //重置,防止干预下次的更新
      syncQueue = null;
    }
  }
}