import { FiberNode, FiberRootNode, PendingPassiveEffects } from "./fiber";
import { ChildDeletion, Flags, MutaionMark, NoFlags, PassiveEffect, PassiveMask, Placement, Update } from "./fiberFlags";
import { appendChildToContainer, commitUpdate, Container, insertChildToContainer, Instance, removeChild } from "hostConfig";
import { FunctionComponent, HostComponent, HostRoot, HostText } from "./workTags";
import { Effect, FCUpdateQueue } from "./fiberHooks";
import { HookHasEffect, Passive } from "./hookEffectTags";

let nextEffect: FiberNode | null = null;

/**
 * 处理上一个阶段，fiberNode生成的副作用，比如挂载，删除， 更新，删除，存在useEffe。
 * @param finishedWork 
 * @param root 
 */
export const commitMutaionEffects = (finishedWork: FiberNode, root: FiberRootNode) => {
  //定义一个全局变量，指向下一个
  nextEffect = finishedWork;

  //这里总体还是先向下，当不满足向下遍历的条件时，在对节点进行处理
  while (nextEffect !== null) {
    //向下遍历
    const child: FiberNode | null = nextEffect.child;

    if ((nextEffect.subTreeFlags & MutaionMark | PassiveMask) !== NoFlags && child !== null) {
      nextEffect = child;
    } else {
      up: while (nextEffect !== null) {
        commitMutationEffectsOnFiber(nextEffect, root);
        const sibling: FiberNode | null = nextEffect.sibling;

        if (sibling !== null) {
          nextEffect = sibling;
          break up;
        }
        //向上遍历
        nextEffect = nextEffect.return;
      }
    }
  }
}

/**
 * 根据flags的类型不同，处理不同的副作用,比如挂载，删除， 更新，删除，存在useEffe
 * @param finishedWork 
 * @param root 
 */
const commitMutationEffectsOnFiber = (finishedWork: FiberNode, root: FiberRootNode) => {
  const flags = finishedWork.flags;

  if ((flags & Placement) !== NoFlags) {
    commitPlacement(finishedWork);

    //将Placement副作用从finishedWork.flags中移出
    finishedWork.flags &= ~Placement
  }

  //flags Update
  if ((flags & Update) !== NoFlags) {
    commitUpdate(finishedWork);

    //将Placement副作用从finishedWork.flags中移出
    finishedWork.flags &= ~Update;
  }

  //flags ChildDeletion
  if ((flags & ChildDeletion) !== NoFlags) {
    const deletions = finishedWork.deletions
    if (deletions !== null) {
      deletions.forEach(childToDelete => {
        commitDeletion(childToDelete, root)
      })
    }

    //将Placement副作用从finishedWork.flags中移出
    finishedWork.flags &= ~ChildDeletion
  }

  //收集useEffect的update回调
  if ((flags & PassiveEffect) !== NoFlags) {
    //收集回调方法
    commitPassiveEffect(finishedWork, root, 'update');
    finishedWork.flags &= ~PassiveEffect;
  }
};

/**
 * 收集useEffect中的回调方法 ,根据参数type，收集的是二种类型的回调（unmount update两种）
 * @param fiber 
 * @param root 
 * @param type 
 * @returns 
 */
function commitPassiveEffect(fiber: FiberNode, root: FiberRootNode, type: keyof PendingPassiveEffects) {


  //当组件不为函数组件  或者 是函数组件 且type === 'update' 但是fiber.flags没有PassiveEffect时，也不行
  if (fiber.tag !== FunctionComponent ||
    (type === 'update' && (fiber.flags & PassiveEffect) === NoFlags)
  ) {
    return;
  }

  //分两种情况 type为update 和 unmount
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
  if (updateQueue !== null) {
    //加一个报错
    if (updateQueue.lastEffect === null && __DEV__) {
      console.error('当FC存在PassiveEffect flag时，不应该不存在effect')
    }
    root.pendingPassiveEffects[type].push(updateQueue.lastEffect as Effect)
  }
}


//遍历Effect环状链表的方法
function commitHookEffectList(flags: Flags, lastEffect: Effect, callback: (effect: Effect) => void) {
  //获取第一个Effect
  let effect = lastEffect.next as Effect;

  do {
    if ((effect.tag & flags) === flags) {
      callback(effect);
    }

    effect = effect.next as Effect;
  } while (effect !== lastEffect.next);
}

//组件卸载 
export function commitHookEffectListUnmount(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destory = effect.destory;
    //当effect里还有函数时，执行，但不会执行update操作，毕竟组件已经卸载了
    if (typeof destory === 'function') {
      destory();
    }
    //
    effect.tag &= ~HookHasEffect;
  });
}

//组件销毁  触发上次更新的destory
export function commitHookEffectListDestory(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destory = effect.destory;
    //当effect里还有函数时，执行
    if (typeof destory === 'function') {
      destory();
    }
  });
}

//组件更新  Create时effect的处理
export function commitHookEffectListCreate(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const create = effect.create;
    //create若为函数，则进行执行，结果是返回destory函数
    if (typeof create === 'function') {
      effect.destory = create();
    }
  });
}


function recordHostChildrenToDelete(childToDelete: FiberNode[], unmountFiber: FiberNode) {
  //1.找到第一个root host节点
  let lastOne = childToDelete[childToDelete.length - 1];

  if (!lastOne) {
    childToDelete.push(unmountFiber);
  } else {
    let node = lastOne.sibling;
    while (node !== null) {
      if (unmountFiber === node) {
        childToDelete.push(unmountFiber);
      }
      node = node.sibling;
    }
  }
  //2.每找到一个 host节点，判断下这个节点是不是1找到那个节点的只弟

}

/**
 * commit阶段删除操作，将 在beginwork阶段标识的删除fiber给删除掉
 * @param childToDelete 
 * @param root 
 */
function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
  //删除的节点是直接删除节点和其子树，如果当前节点是函数组件，那么其子树需要在函数组件下的第一个根节点进行删除
  //但是子树下又存在不同的节点，可能有函数组件或者hostComponent，这里面每种组件对应的删除的处理方法是不同的

  //要删除的childToDelete节点的实际节点，（假如childToDelete为FC,那么要删除的节点就不是它本身）
  let rootChildrenToDele: FiberNode[] = [];
  //递归子树,将每一个childToDelete都当作参数放到unmountFiber=>{}执行
  commitNestedComponent(childToDelete, unmountFiber => {
    // console.log("rootHostNode", rootHostNode)
    // console.log("unmountFiber", unmountFiber)
    switch (unmountFiber.tag) {
      case HostComponent:
        recordHostChildrenToDelete(rootChildrenToDele, unmountFiber);
        // TODO 解绑ref
        return;
      case HostText:
        recordHostChildrenToDelete(rootChildrenToDele, unmountFiber);
        return;
      case FunctionComponent:
        //TODO  解绑ref

        //useEffect
        commitPassiveEffect(unmountFiber, root, 'unmount');
        return;
      default:
        if (__DEV__) {
          console.warn('未处理的unmount类型', unmountFiber)
        }
    }
  })

  //移除rootHostNode的dom
  if (rootChildrenToDele.length) {
    const hostParent = getHostParent(childToDelete);
    if (hostParent !== null) {
      rootChildrenToDele.forEach(node => {
        removeChild(node.stateNode, hostParent);
      })

      // removeChild(rootHostNode, hostParent);
    }
  }

  childToDelete.return = null;
  childToDelete.child = null;
}

//递归子树函数
function commitNestedComponent(
  root: FiberNode,
  //回调函数
  onCommitUnmount: (fiber: FiberNode) => void
) {
  let node = root;
  // console.log("commitNestedComponent的参数", root)
  // console.log("node", node)

  while (true) {
    onCommitUnmount(node);
    // console.log("递归的节点", node)
    //当孩子节点不为空时 
    if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }

    //终止条件
    if (node == root) {
      return;
    }

    //孩子节点为空，且没有邻居节点
    while (node.sibling === null) {
      if (node.return === null || node.return === root) {
        return;
      }
      //向上归
      node = node.return;
    }

    //孩子节点为空，但是邻居节点不为空
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

const commitPlacement = (finishedWork: FiberNode) => {
  if (__DEV__) {
    console.warn('执行Placement操作', finishedWork)
  }
  //找到parent Dom，就是父节点的stateNode
  const hostParent = getHostParent(finishedWork);

  //host sibling
  const sibling = getHostSibling(finishedWork);


  //finishedWork -> dom append parent dom
  if (hostParent !== null) {
    insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling);
  }
}

//获取fiber的对应的兄弟dom
function getHostSibling(fiber: FiberNode) {
  let node: FiberNode = fiber;
  findSibling: while (true) {
    while (node.sibling === null) {
      const parent = node.return;

      if (parent === null ||
        parent.tag === HostComponent ||
        parent.tag === HostRoot
      ) {
        return null;
      }
      node = parent;
    }


    node.sibling.return = node.return;
    node = node.sibling;

    while (node.tag !== HostText && node.tag !== HostComponent) {
      //向下遍历

      if ((node.flags & Placement) !== NoFlags) {
        continue;
      }
      if (node.child === null) {
        continue findSibling;
      } else {
        node.child.return = node;
        node = node.child;
      }
    }

    if ((node.flags & Placement) === NoFlags) {
      return node.stateNode;
    }
  }
}

//找到fiber的父节点的dom，就是
function getHostParent(fiber: FiberNode): Container | null {
  let parent = fiber.return;
  while (parent) {
    const parentTag = parent.tag;

    //HostComponent  HostRoot
    if (parentTag === HostComponent) {
      return parent.stateNode as Container;
    }

    if (parentTag === HostRoot) {
      return (parent.stateNode as FiberRootNode).container
    }

    //如果上面都不是
    parent = parent.return;
  }

  if (__DEV__) {
    console.warn('未找到hostparent')
  }

  return null;
}


function insertOrAppendPlacementNodeIntoContainer(finishedWork: FiberNode, hostParent: Container, before?: Instance) {
  //传入的finishedWork可能不说host类型的，所以需要向下遍历，找到host类型的fiber
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    if (before) {
      insertChildToContainer(finishedWork.stateNode, hostParent, before);
    } else {
      appendChildToContainer(hostParent, finishedWork.stateNode);
    }
    return;
  }

  //此处对应的是finishedWork是函数组件，需要获取他的child（孩子节点可能不只一个），再插入。
  const child = finishedWork.child;
  if (child !== null) {
    insertOrAppendPlacementNodeIntoContainer(child, hostParent)
    let sibling = child.sibling;

    //可能存在兄弟节点
    while (sibling !== null) {
      insertOrAppendPlacementNodeIntoContainer(sibling, hostParent)
      sibling = sibling.sibling;
    }
  }
}

