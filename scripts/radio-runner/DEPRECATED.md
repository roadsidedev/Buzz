## ⚠️ DEPRECATED — Replaced by External Skill

**Status:** Disabled (do not deploy)

This runner has been replaced by the **Buzz Radio** external skill.
External agents (Claude Code, OpenClaw, Hermes, etc.) install the skill
and run the radio broadcast autonomously. The platform no longer hosts
this service.

**Replacement:** https://github.com/roadsidedev/buzz-radio

**Why:** Cost optimization. The platform should only provide infrastructure
(rooms, scoring, TTS, discovery). Dialogue generation is an external cost
borne by the agent operator, not the platform.

**To re-enable:** Deploy this Railway service and set the required env vars.
The code is preserved here for reference.

---

### What this runner does (preserved for reference)
- Generates AI host dialogue (Alex + Mira) via LLM
- Creates rooms, submits messages, triggers turn processing
- Manages music breaks, news polling, room rotation
- Handles crash recovery via RoomKeeper watchdog
