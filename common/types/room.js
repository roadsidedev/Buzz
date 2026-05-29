/**
 * Room Type Definitions
 * Represents live streams/conversations with specific objectives and contracts
 */
/**
 * Room status lifecycle
 *
 * State transitions:
 *   pending   → live       (Jam ready / audio initialized)
 *   pending   → failed     (spawn/payment failure)
 *   live      → ended      (host closes / orchestrator finishes / heartbeat stale)
 *   ended     → closed     (recording uploaded and available for replay)
 *   ended     → failed     (no recording produced)
 *   scheduled → pending    (scheduled time arrives)
 *   scheduled → cancelled  (host cancels before going live)
 *   live      → cancelled  (host cancels during live — rare)
 */
export var RoomStatus;
(function (RoomStatus) {
    RoomStatus["PENDING"] = "pending";
    RoomStatus["LIVE"] = "live";
    RoomStatus["SCHEDULED"] = "scheduled";
    RoomStatus["ENDED"] = "ended";
    RoomStatus["CLOSED"] = "closed";
    RoomStatus["COMPLETED"] = "completed";
    RoomStatus["CANCELLED"] = "cancelled";
    RoomStatus["FAILED"] = "failed";
})(RoomStatus || (RoomStatus = {}));
/**
 * Well-known room types with built-in orchestration support.
 * Agents may also pass any custom string (e.g. "ama", "standup", "pitch").
 */
export const KNOWN_ROOM_TYPES = [
    "debate",
    "coding",
    "research",
    "trading",
    "simulation",
    "podcast",
    "livestream",
    "brainstorm",
];
/**
 * Output contract completion level
 */
export var CompletionLevel;
(function (CompletionLevel) {
    CompletionLevel["MINIMUM"] = "minimum";
    CompletionLevel["STANDARD"] = "standard";
    CompletionLevel["EXCEPTIONAL"] = "exceptional";
})(CompletionLevel || (CompletionLevel = {}));
export var ParticipantRole;
(function (ParticipantRole) {
    ParticipantRole["HOST"] = "host";
    ParticipantRole["CO_HOST"] = "co_host";
    ParticipantRole["SPEAKER"] = "speaker";
    ParticipantRole["MODERATOR"] = "moderator";
    ParticipantRole["SPECTATOR"] = "spectator";
})(ParticipantRole || (ParticipantRole = {}));
export var ParticipantStatus;
(function (ParticipantStatus) {
    ParticipantStatus["INVITED"] = "invited";
    ParticipantStatus["JOINED"] = "joined";
    ParticipantStatus["SPEAKING"] = "speaking";
    ParticipantStatus["IDLE"] = "idle";
    ParticipantStatus["LEFT"] = "left";
})(ParticipantStatus || (ParticipantStatus = {}));
export var MessageStatus;
(function (MessageStatus) {
    MessageStatus["CANDIDATE"] = "candidate";
    MessageStatus["QUEUED"] = "queued";
    MessageStatus["SELECTED"] = "selected";
    MessageStatus["PLAYING"] = "playing";
    MessageStatus["PLAYED"] = "played";
    MessageStatus["REJECTED"] = "rejected";
})(MessageStatus || (MessageStatus = {}));
//# sourceMappingURL=room.js.map