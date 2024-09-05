import { FiberNode } from "react-reconciler/src/fiber";
import { HostComponent, HostText } from "react-reconciler/src/workTags";
import { updateFiberProps } from "./SyntheticEvent";
import { Props } from "shared/ReactType";
import { DOMElement } from "./SyntheticEvent"

export type Container = Element;
export type Instance = Element;
export type TextInstance = Text;

// export const createInstance = (type:string,props:any):Instance=>{
export const createInstance = (type: string, props: Props): Instance => {
  //TODO 处理props
  const element = document.createElement(type) as unknown;
  //给创建的element，添加newprops (就是wip.pendingProps，按理说是要跟旧的props进行比对，取出更新的props)
  updateFiberProps(element as DOMElement, props)
  return element as DOMElement;
}


export const appendInitChild = (parent: Instance | Container, child: Instance) => {
  parent.appendChild(child)
}


export const createTextInstance = (content: string) => {
  return document.createTextNode(content);
}

export const appendChildToContainer = appendInitChild;


export function commitUpdate(fiber: FiberNode) {
  switch (fiber.tag) {
    case HostText:
      const text = fiber.memoizedProps.content;
      return commitTextUpdate(fiber.stateNode, text)
    case HostComponent:
      return updateFiberProps(fiber.stateNode,fiber.memoizedProps);
    default:
      if (__DEV__) {
        console.warn("未实现的Update类型", fiber)
      }
      break;
  }
}

export function commitTextUpdate(textInstance: TextInstance, content: string) {
  textInstance.textContent = content;
}

export function removeChild(child: Instance | TextInstance, container: Container) {
  // console.log("removeChild里面的要删除的child", child)
  container.removeChild(child);
  // console.log("removeChild执行之后")
}



export function insertChildToContainer(
  child: Instance,
  container: Container,
  before: Instance
) {
  container.insertBefore(child, before)
}

/**
 * 在微任务执行回调函数，  如果当前宿主环境支持queueMicrotask，就用queueMicrotask构造微任务，
 * 不支持就用Promise构造微任务，在不至此就只能用setTimeout构造宏任务
 */
export const scheduleMicroTask = 
typeof queueMicrotask === 'function'
  ? queueMicrotask
  : typeof Promise === 'function'
    ? (callback: (...args: any) => void) => Promise.resolve(null).then(callback)
    : setTimeout;
