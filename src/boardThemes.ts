export type BoardTheme={id:string;name:string;description:string;image:string;clearings:readonly (readonly [number,number])[]};
// Measured painted landing centers, clockwise from the upper left. Logical
// spaces stay identical when changing landscapes, including in existing saves.
const centers=(pixels:readonly (readonly [number,number])[],width=1586)=>
  pixels.map(([x,y])=>[x/width,y/992] as const);
export const BOARD_THEMES:readonly BoardTheme[]=[
  {id:'valley',name:'Golden Kingdom',description:'Rolling valleys · kingdom scale',image:'art/boards/epic-v1/valley.png',clearings:centers([[155,192],[397,130],[658,119],[857,242],[1073,178],[1295,205],[1480,321],[1336,423],[1071,490],[949,685],[793,814],[615,835],[385,852],[126,772],[105,598],[134,400]])},
  {id:'alpine',name:'Alpine Realms',description:'Mountain passes · monumental scale',image:'art/boards/epic-v1/alpine.png',clearings:centers([[152,187],[425,138],[651,98],[852,225],[1059,164],[1305,187],[1490,299],[1337,403],[1106,434],[918,537],[947,686],[726,792],[402,824],[132,738],[109,560],[133,374]])},
  {id:'coast',name:'Sapphire Coast',description:'Cliffside kingdoms · regional scale',image:'art/boards/epic-v1/coast.png',clearings:centers([[171,184],[417,134],[662,110],[860,219],[1068,157],[1294,183],[1467,295],[1338,400],[1092,454],[903,577],[892,721],[638,811],[407,830],[177,776],[149,578],[126,377]])},
  {id:'forest',name:'Elderwood',description:'Ancient wilderness · fortress scale',image:'art/boards/epic-v1/forest.png',clearings:centers([[192,187],[450,136],[668,108],[851,230],[1041,164],[1288,187],[1463,310],[1325,405],[1056,447],[916,557],[932,736],[639,832],[352,782],[150,675],[167,513],[178,359]])},
  {id:'sky',name:'Cloud Highlands',description:'High plateaus · mythic scale',image:'art/boards/epic-v1/sky.png',clearings:centers([[180,177],[414,130],[648,104],[873,222],[1059,157],[1302,188],[1476,305],[1338,406],[1079,438],[910,544],[885,713],[610,807],[210,764],[156,600],[142,442],[121,295]],1585)},
];
export function boardTheme(id:string):BoardTheme{return BOARD_THEMES.find(board=>board.id===id)??BOARD_THEMES[0]}
