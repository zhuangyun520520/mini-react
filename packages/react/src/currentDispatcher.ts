import { Action } from "shared/ReactType";

export interface Dispatcher {
  useState: <T>(initialState: (() => T) | T) => [T, Dispatch<T>];
  useEffect: (callback: () => void |void, deps:any[] |void)=> void;
}

export type Dispatch<State> = (action: Action<State>) => void;

//当前使用的hooks集合
const currentDispatcher: { current: Dispatcher | null } = {
  current: null
}

export const resolveDispatcher = (): Dispatcher => {
  const dispatcher = currentDispatcher.current;

  if (dispatcher === null) {
    throw new Error("currentDispatcher 文件hook只能在函数组件中执行")
  }
  return dispatcher
}

export default currentDispatcher