import { ReactElementType } from "shared/ReactType";
import { FiberNode, FiberRootNode } from "./fiber";
import { Container } from "hostConfig";
import { createUpdate, createUpdateQueue, enqueueUpdate, UpdateQueue } from "./updateQueue";
import { HostRoot } from "./workTags";
import { scheduleUpdateOnFiber } from "./workLoop"
import { requestUpdateLane } from "./fiberLanes";
import { unstable_ImmediatePriority, unstable_runWithPriority } from "scheduler";


// **ReactDom.createRoot(rootElenment(等于root)).render(<App/>)**
//ReactDom.createRoot()就会调用createContainer方法

export function createContainer(container: Container) {

  //根节点FiberRootNode下的rootfiber
  const hostRootFiber = new FiberNode(HostRoot, {}, null);
  //fiberNode树的顶级跟节点FiberRootNode
  const root = new FiberRootNode(container, hostRootFiber);
  hostRootFiber.updateQueue = createUpdateQueue();
  return root;

}
//.render(<App/>)就会调用updateContainer方法
//element 就是App,  root=FiberRootNode
export function updateContainer(element: ReactElementType | null, root: FiberRootNode) {
  //mount时开启了同步更新优先级
  unstable_runWithPriority(unstable_ImmediatePriority,()=>{
    const hostRootFiber = root.current
  const lane = requestUpdateLane(); //这里获取的是山下文的优先级
  //这里的update就是<App/>
  const update = createUpdate<ReactElementType | null>(element,lane);
  enqueueUpdate(
    hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>
    , update);

  //如何链接renderRoot方法
  scheduleUpdateOnFiber(hostRootFiber,lane)
  });
  return element;
}