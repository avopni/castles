import {lazy,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
const App=lazy(()=>import('./Game'));
createRoot(document.getElementById('root')!).render(<Suspense fallback={<div style={{padding:30,color:'#e7dcc2',background:'#142c23'}}>Gathering the woodland houses…</div>}><App/></Suspense>);
