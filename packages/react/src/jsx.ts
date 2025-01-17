import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from '../../shared/ReactSymbols'
import { Type, Key, Ref, Props, ReactElementType, ElementType } from '../../shared/ReactType'



const ReactElement = function (
  type: Type,
  key: Key,
  ref: Ref,
  props: Props
): ReactElementType {
  const element = {
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key,
    ref,
    props,
    _mark: 'zhangsan'
  };

  return element;
};


export const jsx = (type: ElementType, config: any, ...maybeChildren: any) => {

  let key: Key = null;
  const props: Props = {};
  let ref: Ref = null;

  for (const prop in config) {
    const val = config[prop]
    if (prop === 'key') {
      if (val !== undefined) {
        key = '' + val;
      }
      continue;
    }

    if (prop === 'ref') {
      if (val !== undefined) {
        ref = val;
      }
      continue;
    }

    if ({}.hasOwnProperty.call(config, prop)) {
      props[prop] = val;
    }
  }

  const maybeChildrenkength = maybeChildren.length;
  // children    [children,children,children,children]存在一个孩子或者多个
  if (maybeChildrenkength) {
    if (maybeChildrenkength === 1) {
      props.children = maybeChildren[0]
    } else {
      props.children = maybeChildren
    }
  }

  return ReactElement(type, key, ref, props)

}

export const Fragment = REACT_FRAGMENT_TYPE;

export const jsxDEV = (type: ElementType, config: any) => {

  let key: Key = null;
  const props: Props = {};
  let ref: Ref = null;

  for (const prop in config) {
    const val = config[prop]
    if (prop === 'key') {
      if (val !== undefined) {
        key = '' + val;
      }
      continue;
    }

    if (prop === 'ref') {
      if (val !== undefined) {
        ref = val;
      }
      continue;
    }

    if ({}.hasOwnProperty.call(config, prop)) {
      props[prop] = val;
    }
  }
  return ReactElement(type, key, ref, props)
}