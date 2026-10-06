/** Appearance-review geometry contract. Final animal meshes must fit this envelope. */
export const TOWER_PITCH = 0.92;
export const ROOF_CLEAR_RADIUS = 0.45;
export const UNIT_ENVELOPE_RADIUS = 0.13;
export const UNIT_BASE_RADIUS = 0.12;
export const SLOT_RING_RADIUS = 0.29;
export const UNIT_BASE_CENTER_Y = 0.025;
export const UNIT_BASE_HEIGHT = 0.025;
export const TOWER_ORIGIN_Y = 0.075;
export const ROOF_FLOOR_Y = TOWER_ORIGIN_Y + 0.72 + 0.09 / 2;
export const GROUND_FLOOR_Y = 0.015 + 0.1 / 2;

export function surfaceSlot(index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= 6)
    throw new RangeError("A standing surface has six slots");
  const angle = Math.PI / 6 + index * Math.PI / 3;
  return { x: Math.sin(angle) * SLOT_RING_RADIUS, z: Math.cos(angle) * SLOT_RING_RADIUS };
}

export function unitOriginY(towerCount: number) {
  const floor = towerCount ? (towerCount - 1) * TOWER_PITCH + ROOF_FLOOR_Y : GROUND_FLOOR_Y;
  return floor - UNIT_BASE_CENTER_Y + UNIT_BASE_HEIGHT / 2;
}
