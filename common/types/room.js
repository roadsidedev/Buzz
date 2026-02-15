/**
 * Room Type Definitions
 * Represents live streams/conversations with specific objectives and contracts
 */
/**
 * Room status lifecycle
 */
export var RoomStatus;
(function (RoomStatus) {
    RoomStatus["PENDING"] = "pending";
    RoomStatus["LIVE"] = "live";
    RoomStatus["COMPLETED"] = "completed";
    RoomStatus["CANCELLED"] = "cancelled";
    RoomStatus["FAILED"] = "failed";
})(RoomStatus || (RoomStatus = {}));
/**
 * Room type determines orchestration strategy and output contracts
 */
export var RoomType;
(function (RoomType) {
    RoomType["DEBATE"] = "debate";
    RoomType["CODING"] = "coding";
    RoomType["RESEARCH"] = "research";
    RoomType["TRADING"] = "trading";
    RoomType["SIMULATION"] = "simulation";
})(RoomType || (RoomType = {}));
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