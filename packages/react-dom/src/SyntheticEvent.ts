//合成事件


/**
 * scheduler下的优先级
 * unstable_ImmediatePriority  立即优先级 数值为 1，是最高优先级此优先级的任务会立即执行，通常用于需要同步完成的任务。适用于必须尽快响应的用户交互或关键操作。
 * unstable_UserBlockingPriority  用户阻塞优先级 数值为 2。这种优先级的任务会尽快执行，但允许其他高优先级任务插入。适用于可能影响用户体验的任务，比如用户输入事件处理。
 * unstable_NormalPriority    普通优先级，数值为 3。这是默认优先级，用于一般任务，不会立即执行，但也不会被无限期推迟。适用于不紧急但需要及时完成的任务
 * unstable_LowPriority   低优先级，数值为 4。这种优先级的任务会在所有高优先级任务完成后执行，但不如空闲优先级低。适用于非关键但需要在相对较短时间内完成的任务。
 * unstable_IdlePriority   空闲优先级，数值为 5，是最低优先级。此优先级的任务只有在系统空闲时才会执行，不会影响性能。适用于不紧急且可以延迟执行的任务，比如日志记录或低优先级的数据同步。
 */
import {
	unstable_ImmediatePriority, 
	unstable_NormalPriority,  
	unstable_runWithPriority, 
	unstable_UserBlockingPriority  
} from 'scheduler';

import { Container } from "hostConfig";
import { Props } from "shared/ReactType";

export const elementPropsKey = "__props";
//目前支持的时间类型
const validEventTypeList = ['click'];

type EventCallback = (e: Event) => void;

//定义合成事件的类型
interface SybtheticEvent extends Event {
  //能够阻止事件传递
  __stopPropagation: boolean;
}

interface Paths {
  capture: EventCallback[];
  bubble: EventCallback[];
}

export interface DOMElement extends Element {
  [elementPropsKey]: Props;
}



export function updateFiberProps(node: DOMElement, props: Props) {
  node[elementPropsKey] = props;
}

//事件初始化方法
export function initEvent(container: Container, eventType: string) {
  if (!validEventTypeList.includes(eventType)) {
    console.warn('当前不支持', eventType, '事件');
    return;
  }

  if (__DEV__) {
    console.log('初始化事件', eventType);
  }
  //给容器添加事件监听
  container.addEventListener(eventType, (e) => {
    dispatchEvent(container, eventType, e)
  });
}

//创建合成事件
function createSyntheticEvent(e: Event) {
  const syntheticEvent = e as SybtheticEvent;
  syntheticEvent.__stopPropagation = false;

  const originStopPropagation = e.stopPropagation;

  syntheticEvent.stopPropagation = () => {
    syntheticEvent.__stopPropagation = true;
    if (originStopPropagation) {
      originStopPropagation();
    }
  };
  return syntheticEvent;
}

function dispatchEvent(container: Container, eventType: string, e: Event) {
  const targetElement = e.target;

  if (targetElement === null) {
    console.warn('事件不存在target', e);
    return;
  }

  //1.收集沿途的事件
  const { bubble, capture } = collectPaths(targetElement as DOMElement, container, eventType)
  //2.构造合成事件
  const se = createSyntheticEvent(e);
  //3.遍历captue
  triggerEventFlow(capture, se);

  if (!se.__stopPropagation) {
    //4.遍历bubble
    triggerEventFlow(bubble, se);
  }

}

function triggerEventFlow(paths: EventCallback[], se: SybtheticEvent) {
  for (let i = 0; i < paths.length; i++) {
    const callback = paths[i];
    unstable_runWithPriority(eventTypeToSchdulerPriority(se.type), () =>{
      callback.call(null, se);
    })
    

    //当为true时，阻止事件传播
    if (se.__stopPropagation) {
      break;
    }
  }
}

function getEventCallbackNameFromEventType(eventType: string): string[] | undefined {
  return {
    click: ['onClickCapture', 'onClick']
  }[eventType];
}

function collectPaths(targetElement: DOMElement, container: Container, eventType: string) {
  //收集结果
  const paths: Paths = {
    capture: [],
    bubble: []
  }

  while (targetElement && targetElement !== container) {
    //收集
    const elementProps = targetElement[elementPropsKey];
    if (elementProps) { 
      const callbackNameList = getEventCallbackNameFromEventType(eventType); //获取事件类型对应的回调名
      if (callbackNameList) {//回调名存在
        //遍历
        callbackNameList.forEach((callbackName, i) => {
          const eventCallback = elementProps[callbackName];
          if (eventCallback) {
            if (i === 0) {
              //onClickCapture
              //捕获的回调列表capture， 反向push
              paths.capture.unshift(eventCallback);
            } else {
              //onClick
              //冒泡的回调列表bubble，正向push
              paths.bubble.push(eventCallback);
            }
          }
        })
      }
    }
    targetElement = targetElement.parentNode as DOMElement;
  }
  return paths;
}

/**
 * 根据不同的事件返回不同的优先级
 * @param eventType 
 * @returns 
 */
function eventTypeToSchdulerPriority(eventType: string) {
	switch (eventType) {
		case 'click':
		case 'keydown':
		case 'keyup':
			return unstable_ImmediatePriority;
		case 'scroll':
			return unstable_UserBlockingPriority;
		default:
			return unstable_NormalPriority;
	}
}
