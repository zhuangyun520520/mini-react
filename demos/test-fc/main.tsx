
import { useState, useEffect } from '../../packages/react/index';
import ReactDOM from '../../packages/react-dom'

// function App() {
//   const [num, setNum] = useState(100);
//   const arr = num % 2 === 0 ? [
//     <li key="1">1</li>,
//     <li key="2">2</li>,
//     <li key="3">3</li>
//   ] : [
//     <li key="3">3</li>,
//     <li key="2">2</li>,
//     <li key="1">1</li>
//   ]

//   return (
//     <ul onClick={() => {
//       setNum((num) =>num + 1);
//       setNum((num) =>num + 1);
//       setNum((num) =>num + 1);
//     }}>
//       {num}
//     </ul>
//   )
//   // return <ul onClick={() => setNum(num + 1)}>{arr}</ul>;
// }


// function App() {
//   const [num, updateNum] = useState(0);
//   useEffect(() => {
//     console.log('App mount');
//   }, []);

//   useEffect(() => {
//     console.log('num change create');
//     return () => {
//       console.log('num change destory');
//     };

//   }, [num]);


//   return (
//     <div onClick={() => updateNum(num + 1)}>
//       {num === 0 ? <Child /> : 'noop'}
//     </div>
//   );
// }


// function Child() {
//   useEffect(() => {
//     console.log('Child mount');
//     return () => console.log('Child unmount')
//   }, []);

//   return 'i am child';
// }

function App() {
  const [num, update] = useState(100);
  return (
    <ul onClick={() => update(50)}>
      {new Array(num).fill(0).map((_, i) => {
        return <Child key={i}>{i}</Child>
      })}
    </ul>
  );
}

function Child({ children }) {
  const now = performance.now();
  while (performance.now() - now < 4) { }
  return <li>{children}</li>;
}

// ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
//   <App />
// )

const root = ReactDOM.createRoot(document.querySelector('#root'));
root.render(
  <App />
)

