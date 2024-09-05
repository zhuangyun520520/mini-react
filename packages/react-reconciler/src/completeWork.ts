import { FiberNode } from "./fiber"
import { Container, createInstance, Instance } from "hostConfig";
import { Fragment, FunctionComponent, HostComponent, HostRoot, HostText } from "./workTags";
import { appendInitChild, createTextInstance } from 'hostConfig'
import { NoFlags, Placement, Update } from "./fiberFlags";

/**
 * 递归中的归阶段，completeWork承担了比如说创建DOM节点， 冒泡DOM,lanes, flags等任务，构建离屏DOM树
 * @param wip 也会随着递归发生变化
 * @returns 
 */
export const completeWork = (wip: FiberNode) => {
  const newProps = wip.pendingProps;
  const current = wip.alternate;

  switch (wip.tag) {
    case HostComponent:
      //构建dom树
      //但是也分是mount还是update
      if (current !== null && wip.stateNode) {
        //update
        // TODO update
        //1. props 是否变化{onclick:name1}  {onclick:name2}
        //2. 变了 Update flag
        //在这里不进行判断，props是否发生变化，直接使用
        //简单做一下，后续要改
        markUpdate(wip);
      } else {
        //mount
        //1：构建dom,为父节点
        // const instance = createInstance(wip.type,newProps) 
        const instance = createInstance(wip.type,newProps)
        //将wip里面的dom插入到instance中,这里，如果wip的孩子是函数组件，则还会向下遍历一次孩子，将这次的孩子插入到instance中
        appendAllChildren(instance, wip)
        wip.stateNode = instance
      }
      //将beginwork生成的副作用（Placement 以及childDetion）冒泡上去。
      bubbleProperties(wip);
      return null;
    case HostText:
      if (current !== null && wip.stateNode) {
        //update
        const oldText = current.memoizedProps?.content;
        const newText = newProps.content;

        if (oldText !== newText) {
          //标记更新
          markUpdate(wip)
        }
      } else {
        //mount
        //1：构建dom
        const instance = createTextInstance(newProps.content)
        wip.stateNode = instance

      }
      bubbleProperties(wip);
      return null;
    case HostRoot:
      bubbleProperties(wip);
      return null;
    case FunctionComponent:
      bubbleProperties(wip);
      return null;
    case Fragment:
      bubbleProperties(wip);
      return null;
    default:
      if (__DEV__) {
        console.warn('未处理的completeWork情况', wip)
      }
      break;
  }
}

//FiberNode标记更新
function markUpdate(fiber: FiberNode) {
  fiber.flags |= Update;
}

function appendAllChildren(parent: Container | Instance, wip: FiberNode) {
  let node = wip.child;
  while (node != null) {
    if (node.tag === HostComponent || node.tag === HostText) {
      appendInitChild(parent, node.stateNode)
    } else if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }

    if (node === wip) {
      return;
    }

    while (node.sibling === null) {
      if (node.return === null || node.return === wip) {
        return;
      }
      node = node?.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;

  }
}

//将子树的副作用向上冒泡
function bubbleProperties(wip: FiberNode) {
  let subTreeFlags = NoFlags;
  let child = wip.child;

  //按位或复制运算只要有一个1值就为1
  while (child !== null) {
    subTreeFlags |= child.subTreeFlags;
    subTreeFlags |= child.flags;

    child.return = wip;
    child = child.sibling;
  }

  wip.subTreeFlags |= subTreeFlags
}