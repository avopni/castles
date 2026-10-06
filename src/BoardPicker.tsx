import {BOARD_THEMES} from './boardThemes';

export function BoardPicker({value,onChange}:{value:string;onChange:(id:string)=>void}){
  return <section className="board-picker" aria-label="Board landscape">
    <h3>Choose your board</h3>
    <p>Switch the scenery at any time. Your gathering stays in place.</p>
    <div className="board-options">{BOARD_THEMES.map(board=><button key={board.id} type="button" aria-pressed={value===board.id} onClick={()=>onChange(board.id)}>
      <img src={import.meta.env.BASE_URL+board.image} alt="" loading="lazy"/>
      <span className="board-choice-status">{value===board.id?'Selected':'Choose board'}</span><strong>{board.name}</strong><small>{board.description}</small>
    </button>)}</div>
    <a href={`${import.meta.env.BASE_URL}boards/index.html`} target="_blank" rel="noreferrer">Compare full-size boards ↗</a>
  </section>;
}
