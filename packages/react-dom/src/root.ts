// ReactDOM.reateRoot(root).render(<App/>)

import { Container } from "hostConfig";
import { createContainer, updateContainer } from "react-reconciler/src/fiberReconciler";
import { ReactElementType } from "shared/ReactType";
import { initEvent } from "./SyntheticEvent";

export function createRoot(container:Container){
  const root = createContainer(container);

  return{
    render(element:ReactElementType) {
      initEvent(container,'click');
      updateContainer(element,root)
    }
  };
}