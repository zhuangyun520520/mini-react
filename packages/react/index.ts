import { Dispatcher, resolveDispatcher, } from "./src/currentDispatcher"
import { jsxDEV } from "./src/jsx"
import currentDispatcher from './src/currentDispatcher'

//React
export const useState: Dispatcher['useState'] = (initialState) => {
  // console.log("react,index.ts拿到的useState的参数", initialState)
  const dispatcher = resolveDispatcher();
  // console.log("react拿到的dispatcher", dispatcher);
  return dispatcher.useState(initialState); 
};

export const useEffect: Dispatcher['useEffect'] = (create,deps) => {
  // console.log("react,index.ts拿到的useState的参数", initialState)
  const dispatcher = resolveDispatcher();
  // console.log("react拿到的dispatcher", dispatcher);
  return dispatcher.useEffect(create,deps); 
};


//hosk的内部数据共享层
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_FILED = {
  currentDispatcher   
}

export default {
  version: '1.1.1',
  createElement: jsxDEV
}
