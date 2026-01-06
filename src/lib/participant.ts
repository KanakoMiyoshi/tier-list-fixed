export function getOrCreateParticipantId(): string {
  const key = "participant_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function getSavedName(): string {
  return localStorage.getItem("participant_name") ?? "";
}

export function saveName(name: string) {
  localStorage.setItem("participant_name", name);
}
