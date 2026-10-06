export function Portrait({ faction, className = "" }: { faction: string; className?: string }) {
  return <img className={`animal-portrait ${className}`} src={`${import.meta.env.BASE_URL}art/portraits/${faction.toLowerCase()}.png`} alt={`${faction} in medieval woodland dress`} />;
}
