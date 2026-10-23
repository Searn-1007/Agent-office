// The office setup comes from the UI: a list of rooms, each with a role and a
// prompt. This module validates it and turns a room into launch instructions.

const REPLY_LANGUAGE = 'Reply to the user in Vietnamese unless they write in another language.';
const ID_RE = /^[a-z0-9]{1,12}$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Returns a clean setup or throws with a Vietnamese message. */
export function validateSetup(raw) {
  if (!raw || !Array.isArray(raw.rooms) || raw.rooms.length < 1 || raw.rooms.length > 5) {
    throw new Error('Thiết lập cần từ 1 đến 5 phòng');
  }
  const seen = new Set();
  const rooms = raw.rooms.map((r) => {
    const id = str(r?.id, 12);
    if (!ID_RE.test(id) || seen.has(id)) throw new Error(`Mã phòng không hợp lệ: ${id}`);
    seen.add(id);
    return {
      id,
      name: str(r.name, 40) || id,
      label: str(r.label, 24) || id,
      color: COLOR_RE.test(r.color) ? r.color : '#3a86ff',
      theme: str(r.theme, 16) || 'code',
      coordinator: r.coordinator === true,
      prompt: str(r.prompt, 4000),
    };
  });
  return { name: str(raw.name, 40) || 'Văn phòng', rooms };
}

export function findRoom(setup, roomId) {
  return setup?.rooms.find((r) => r.id === roomId) ?? null;
}

/** Instructions appended to Claude Code's system prompt for an agent in `room`. */
export function buildPrompt(setup, room) {
  const parts = [room.prompt.trim()];
  const others = setup.rooms.filter((r) => r.id !== room.id);
  if (room.coordinator && others.length) {
    parts.push(
      'You work in an AI office and coordinate these rooms:',
      ...others.map((r) => `- ${r.id}: ${r.label} (${r.name}) — ${r.prompt.split(/[.!?]/)[0]}.`),
      'Delegate work with the Agent tool. Start every sub-agent description with the room id and a colon (for example "' +
        `${others[0].id}: ...` +
        '") so it walks to that room. Run independent tasks in parallel, check the results, and report a concise summary.',
    );
  } else {
    parts.push(`You work in the "${room.name}" of an AI office, as the ${room.label}.`);
  }
  parts.push(REPLY_LANGUAGE);
  return parts.filter(Boolean).join('\n');
}

/** Which room a sub-agent belongs in: an explicit "id:" prefix wins, then a
 *  room whose id or label appears in the text, then the spawner's own room. */
export function roomForSubagent(setup, fallbackId, description = '', subagentType = '') {
  const rooms = setup?.rooms ?? [];
  const desc = String(description).trim().toLowerCase();
  const prefix = desc.match(/^([a-z0-9]{1,12})\s*:/)?.[1];
  if (prefix && rooms.some((r) => r.id === prefix)) return prefix;
  const text = `${subagentType} ${desc}`.toLowerCase();
  for (const r of rooms) {
    if (r.coordinator) continue;
    if (text.includes(r.id) || text.includes(r.label.toLowerCase())) return r.id;
  }
  return fallbackId;
}
