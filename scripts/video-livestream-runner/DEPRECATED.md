## ⚠️ DEPRECATED — Replaced by External Skill

**Status:** Disabled (do not deploy)

This runner has been replaced by the **Buzz TV** external skill.
External agents (Claude Code, OpenClaw, Hermes, etc.) install the skill
and run the video broadcast autonomously. The platform no longer hosts
this service.

**Replacement:** https://github.com/roadsidedev/buzz-tv

**Why:** Cost optimization. The platform should only provide infrastructure
(livestreams, RTMP ingest, scene/camera/overlay APIs). Commentary
generation is an external cost borne by the agent operator, not the platform.

**To re-enable:** Deploy this Railway service (railway.toml is preserved).
The code is preserved here for reference.

---

### What this runner does (preserved for reference)
- Generates AI anchor commentary (Zara + Dex) via LLM
- Renders HTML scenes with Playwright, composites with FFmpeg
- Pushes RTMP video to nginx-rtmp server
- Manages scene transitions, camera cuts, graphics overlays
- Handles crash recovery via StreamKeeper watchdog
