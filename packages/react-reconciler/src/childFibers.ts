import { Key, Props, ReactElementType } from "shared/ReactType";
import { createFiberFromElement, createFiberFromFragment, createWorkInProgress, FiberNode } from "./fiber";
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from "shared/ReactSymbols";
import { HostText } from "./workTags";
import { ChildDeletion, Placement } from "./fiberFlags";
import { Fragment } from "./workTags";



type ExistingChildren = Map<string | number, FiberNode>


function ChildReconciler(shouldTrackEffects: boolean) {

  //删除子节点，目前这个方法只是记录要删除的节点，最后是在commit阶段才实现真正的删除
  //参数returnFiber：父节点，childToDelete：要删除的子节点
  function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode | null) {
    if (!shouldTrackEffects) {
      return;
    }
    const deletions = returnFiber.deletions;
    if (childToDelete !== null) {
      if (deletions === null) {
        returnFiber.deletions = [childToDelete];
        //只有当首次添加 要删除的节点时，才会用returnFiber添加副作用。
        returnFiber.flags |= ChildDeletion;
      } else {
        deletions.push(childToDelete);
      }
    }
  }
  //删除其他节点
  function deleteRemainingChildren(returnFiber: FiberNode, currentFirstChild: FiberNode | null) {
    if (__DEV__) {
      return;
    }
    let childToDelete = currentFirstChild;
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete);
      // const childSibling = childToDelete.sibling;
      // if (childSibling !== null) {
      childToDelete = childToDelete!.sibling;
      // }
    }
  }

  //渲染单个element，生成fibernode。    这里面的单个节点指的是更新之后是单节点，同理多节点就是更新之后是多节点
  function reconcileSingleElement(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: ReactElementType
  ) {
    const key = element.key;
    while (currentFiber !== null) {
      //update
      if (currentFiber.key === key) {
        //key相同
        if (element.$$typeof = REACT_ELEMENT_TYPE) {
          if (currentFiber.type === element.type) {
            //对fragment进行判断   
            let props = element.props;
            if (element.type === REACT_FRAGMENT_TYPE) {
              props = element.props.children;
            }

            //type相同   复用节点，但是props用的还是新的
            const existing = useFiber(currentFiber, element.props)
            existing.return = returnFiber;
            // 当前节点可复用，标记其他节点删除， 渲染单个元素时，为什么节点可以复用，但是还是要删除他的sibling??????????
            deleteRemainingChildren(returnFiber, currentFiber.sibling);
            return existing;
          }
          //key相同type不同，删除所有旧的
          deleteRemainingChildren(returnFiber, currentFiber);
          break;
        } else {
          if (__DEV__) {
            console.warn('还未实现的react类型', element);
            break;
          }
        }
      } else {
        //key不相同 ，删掉当前旧的
        deleteChild(returnFiber, currentFiber);
        currentFiber = currentFiber.sibling;
      }
    }
    //根据element创建fiber
    let fiber;
    if (element.type === REACT_FRAGMENT_TYPE) {
      fiber = createFiberFromFragment(element.props.children, key);
    } else {
      fiber = createFiberFromElement(element);
    }
    fiber.return = returnFiber;
    return fiber
  }

  function reconcileSingleTextNode(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    content: string | number
  ) {
    while (currentFiber !== null) {
      //update
      if (currentFiber.tag === HostText) {
        //类型没变，复用
        const existing = useFiber(currentFiber, { content });
        existing.return = returnFiber;
        deleteRemainingChildren(returnFiber, currentFiber.sibling);
        return existing;
      }
      // <div>-> hahha   由之前的HostComponent 变成HostText
      deleteChild(returnFiber, currentFiber);
      currentFiber = currentFiber.sibling;
      //然后创建新的HostText
    }
    //创建新的HostText
    const fiber = new FiberNode(HostText, { content }, null);
    fiber.return = returnFiber;
    return fiber;
  }

  //beginwork得性能优化，在首屏渲染且需要添加副作用时，给fiber追加Placement副作用，不满足条件就返回
  function placeSingleChild(fiber: FiberNode) {
    if (shouldTrackEffects && fiber.alternate === null) {
      fiber.flags |= Placement;
    }
    return fiber
  }


  function recocnileChildrenArray(returnFiber: FiberNode, currentFirstChild: FiberNode | null, newChild: any[]) {
    //最后一个可复用fiber在current中的index
    let lastPlacedIndex: number = 0;
    //创建的最后一个fiber
    let lastNewFiber: FiberNode | null = null;
    //创建的第一个fiber,当作最后的结果返回出去
    let firstNewFiber: FiberNode | null = null;
    //1将current保存在map中
    const existingChildren: ExistingChildren = new Map();

    let current = currentFirstChild;
    while (current !== null) {
      const keyToUse = current.key !== null ? current.key : current.index;
      existingChildren.set(keyToUse, current);
      current = current.sibling;

    }

    for (let i = 0; i < newChild.length; i++) {
      //2遍历newChild,寻找是否可复用
      const after = newChild[i];

      //返回复用的fiber或者创建新的fiber
      const newFiber = updateFromMap(returnFiber, existingChildren, i, after);

      if (newFiber === null) {
        continue;
      }

      //3标记移动还是插入
      newFiber.index = i;
      newFiber.return = returnFiber;

      if (lastNewFiber === null) {
        lastNewFiber = newFiber;
        firstNewFiber = newFiber;
      } else {
        lastNewFiber.sibling = newFiber;
        lastNewFiber = lastNewFiber.sibling;
      }

      //如果需要追踪副作用
      if (!shouldTrackEffects) {
        continue;
      }

      const current = newFiber.alternate;
      if (current !== null) {
        const oldIndex = current.index;
        if (oldIndex < lastPlacedIndex) {
          //移动
          newFiber.flags |= Placement;
          continue;
        } else {
          //不移动
          lastPlacedIndex = oldIndex;
        }
      } else {
        //mount 
        newFiber.flags |= Placement;
      }

    }

    //4将map中剩下的标记删除
    existingChildren.forEach(fiber => {
      deleteChild(returnFiber, fiber);
    })

    return firstNewFiber;
  }


  function updateFromMap(returnFiber: FiberNode, existingChildren: ExistingChildren, index: number, element: any): FiberNode | null {
    const keyToUse = element.key !== null ? element.key : index;
    const before = existingChildren.get(keyToUse);

    if (typeof element === 'string' || typeof element === 'number') {
      //HostText
      if (before) {
        if (before.tag === HostText) {
          existingChildren.delete(keyToUse);
          return useFiber(before, { content: element + '' })
        }
      }
      return new FiberNode(HostText, { content: element + '' }, null);
    }

    //ReactElement
    if (typeof element === 'object' && element !== null) {
      switch (element.$$typeof) {
        case REACT_ELEMENT_TYPE:
          if (element.type === REACT_FRAGMENT_TYPE) {
            return updateFragment(returnFiber, before, element, keyToUse, existingChildren);
          }
          if (before) {
            if (before.type === element.type) {
              existingChildren.delete(keyToUse);
              return useFiber(before, element.props);
            }
          }
          return createFiberFromElement(element);
      }
      //TODO 数组类型
      if (Array.isArray(element) && __DEV__) {
        console.warn('还未实现数组类型的child', element);

      }
    }

    if (Array.isArray(element)) {
      return updateFragment(returnFiber, before, element, keyToUse, existingChildren);
    }
    return null;
  }




  return function recocnileChildFibers(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    newChild?: any
  ) {
    //判断fragment
    const isUnkeyedTopLevelFragment = typeof newChild === 'object' && newChild !== null && newChild.type === REACT_FRAGMENT_TYPE && newChild?.key === null;
    if (isUnkeyedTopLevelFragment) {
      //将newChild赋值为newChild.props.children，，这是一个数组
      newChild = newChild.props.children;
    }
    //判断当前fiber的类型
    //单个节点得情况
    if (newChild !== null && typeof newChild === 'object') {
      // 多节点得情况  ul->多个li
      if (Array.isArray(newChild)) {
        return recocnileChildrenArray(returnFiber, currentFiber, newChild);
      }

      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          //reconcileSingleElement函数 ：生成子孩子fibernode，如果是mount，就直接生成一个子fiberNode, 如果是update就比较type和key,相同就复用，不相同就删除旧的，在生成一个新的子fierNode
          //placeSingleChild函数是给生成子fierNode添加副作用
          return placeSingleChild(reconcileSingleElement(returnFiber, currentFiber, newChild));
        default:
          if (__DEV__) {
            console.warn('未实现得reconcile类型', newChild)
          }
          break;
      }

    }


    //HostText
    if (typeof newChild === 'string' || typeof newChild === 'number') {
      return placeSingleChild(reconcileSingleTextNode(returnFiber, currentFiber, newChild));
    }
    //兜底删除
    if (currentFiber !== null) {

      deleteRemainingChildren(returnFiber, currentFiber);
    }


    if (__DEV__) {
      console.warn('未实现得reconcile类型', newChild)
    }

    return null;
  };
}


function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
  const clone = createWorkInProgress(fiber, pendingProps);
  clone.index = 0;
  clone.sibling = null;
  return clone;
}


function updateFragment(returnFiber: FiberNode, current: FiberNode | undefined, elements: any[], key: Key, existingChildren: ExistingChildren) {
  let fiber;
  if (!current || current.tag !== Fragment) {
    fiber = createFiberFromFragment(elements, key);
  } else {
    existingChildren.delete(key);
    fiber = useFiber(current, elements);
  }

  fiber.return = returnFiber;
  return fiber;
}


export const recocnileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);