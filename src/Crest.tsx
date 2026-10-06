import type { Faction } from "./engine/types";
export function Crest({
  faction,
  className = "",
}: {
  faction: Faction;
  className?: string;
}) {
  return (
    <svg
      className={`crest ${className}`}
      viewBox="0 0 80 88"
      aria-label={`${faction} crest`}
      role="img"
    >
      <path
        className="shield"
        d="M8 11Q40-2 72 11V47Q69 70 40 84Q11 70 8 47Z"
      />
      <path className="rim" d="M13 15Q40 5 67 15V47Q64 66 40 78Q16 66 13 47Z" />
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {faction === "Otters" && (
          <>
            <path d="M24 41Q22 23 33 23Q41 15 51 26Q63 33 55 49Q48 61 37 58Q25 57 24 41Z" />
            <path d="M26 28Q20 23 23 19Q29 16 32 23M50 24Q55 18 59 22Q62 28 56 31M33 48Q40 57 48 48M37 42L42 38L48 43M32 36H33M50 36H51M27 60Q44 66 57 58M24 65Q43 72 60 63" />
          </>
        )}
        {faction === "Badgers" && (
          <>
            <path d="M23 34Q22 21 31 24Q40 18 49 24Q60 20 58 35L55 51Q48 60 40 65Q31 60 24 50Z" />
            <path d="M29 26L36 43L30 53M51 26L44 43L50 53M31 37H34M46 37H49M35 53L40 49L45 53L40 57ZM26 61L21 67M53 61L58 67M31 66H49" />
          </>
        )}
        {faction === "Rats" && (
          <>
            <path d="M24 40Q19 30 28 27Q36 20 47 27Q58 22 61 33Q61 41 54 44L42 61Q34 58 30 51Z" />
            <path d="M27 31Q16 25 19 18Q28 14 32 25M47 26Q56 11 64 21Q68 30 57 35M31 40H33M49 39H51M36 50L40 47L44 50M23 45L15 42M23 49L14 51M52 47L62 45M50 51L61 54M30 62Q17 65 22 71Q31 77 57 66" />
          </>
        )}
        {faction === "Rabbits" && (
          <>
            <path d="M28 36Q19 15 26 12Q34 9 37 34M44 34Q43 10 50 9Q59 11 53 37M25 45Q25 34 40 34Q56 34 57 45Q59 60 41 64Q22 60 25 45Z" />
            <path d="M29 17L33 28M50 16L49 28M32 45H34M48 45H50M37 53L41 50L45 53L41 57ZM26 52L17 50M26 56L18 59M55 52L64 50M55 56L63 59M30 69Q41 73 52 69" />
          </>
        )}
      </g>
    </svg>
  );
}
export function CastleMark() {
  return (
    <svg viewBox="0 0 40 44" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        d="M6 38V15H10V8H14V15H18V5H22V15H26V8H30V15H34V38ZM6 23H34M17 38V29Q20 24 23 29V38M12 28V32M28 28V32M3 41H37"
      />
    </svg>
  );
}
export function PieceIcon({ kind }: { kind: "tower" | "wizard" | "potion" }) {
  return (
    <svg viewBox="0 0 40 44" aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {kind === "tower" ? (
          <path d="M10 39V13H7V5H13V10H17V5H23V10H27V5H33V13H30V39ZM10 17H30M10 32H30M17 39V30Q20 26 23 30V39M17 22H23V27H17Z" />
        ) : kind === "wizard" ? (
          <>
            <path d="M13 35L16 19H25L29 35ZM15 36L10 40M28 36L32 40M16 22L7 27M26 22L33 16M33 7V40" />
            <circle cx="20.5" cy="12" r="5" />
            <path d="M16 9L14 3M24 9L27 3" />
          </>
        ) : (
          <path d="M16 5H24V15Q33 20 32 30Q32 39 20 39Q8 39 8 30Q7 20 16 15ZM14 5V9H26V5ZM10 27H30" />
        )}
      </g>
    </svg>
  );
}
