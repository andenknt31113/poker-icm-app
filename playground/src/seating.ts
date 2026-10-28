import { positionsForN, type Player } from "./appState.js";

export function arrangePositions(seats: Player[], buttonId: number): void {
  const buttonIndex = seats.findIndex(player => player.id === buttonId);
  if (buttonIndex < 0) return;
  const positions = positionsForN(seats.length);
  seats.forEach((player, index) => {
    player.position = positions[(index - buttonIndex + seats.length) % seats.length] ?? "";
  });
}

export function moveSeat(seats: Player[], playerId: number, direction: number): void {
  if (direction !== -1 && direction !== 1) return;
  const index = seats.findIndex(player => player.id === playerId);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= seats.length) return;
  const buttonId = seats.find(player => player.position === "BTN")?.id ?? seats[0]!.id;
  const [player] = seats.splice(index, 1);
  seats.splice(destination, 0, player!);
  arrangePositions(seats, buttonId);
}

export function orderSavedSeats(seats: Player[]): void {
  const positions = positionsForN(seats.length);
  if (new Set(seats.map(player => player.position)).size !== seats.length || seats.some(player => !positions.includes(player.position))) return;
  const start = positions.indexOf(seats[0]?.position ?? "");
  if (seats.every((player, index) => player.position === positions[(start + index) % seats.length])) return;
  seats.sort((first, second) => positions.indexOf(first.position) - positions.indexOf(second.position));
}
