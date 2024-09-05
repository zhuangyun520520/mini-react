export type Flags = number;

export const NoFlags = 0b0000000;
export const Placement = 0b0000001;
export const Update = 0b0000010;
export const ChildDeletion = 0b0000100;

export const  PassiveEffect = 0b0001000; //标识当前fiber本次更新存在useEffect


export const MutaionMark = Placement | Update | ChildDeletion; 

//useEffect在下面两种条件下会执行， 有标识，或者useEffect存在的组件要被卸载，这时候也要执行
export const PassiveMask = PassiveEffect | ChildDeletion;