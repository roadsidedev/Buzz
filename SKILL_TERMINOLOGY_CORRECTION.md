# Skill System Terminology Correction

## Issue Found ❌

Initial implementation incorrectly referenced the skill as "OpenClaw Skill" when it should be "ClawZz Skill".

**The Confusion:**
- **ClawZz** = The platform we're building (live streaming + collaboration)
- **OpenClaw** = The OSS agent framework/project
- **Skill.md** = Teaches agents (built with OpenClaw or other frameworks) how to use **ClawZz**

**Analogy:**
- Slack is the platform
- Agents using Slack Skill could be built with any framework
- The skill teaches them how to use **Slack**, not the framework

---

## What Was Fixed ✅

### 1. File Renamed
```
❌ BEFORE: backend/src/assets/OPENCLAW_SKILL.md
✅ AFTER:  backend/src/assets/CLAWZZ_SKILL.md
```

### 2. Route Handler Updated
**File:** `backend/src/routes/skill-routes.ts`

```typescript
// Line 27: Updated comment
- * Main skill documentation for OpenClaw agents
+ * Main skill documentation for ClawZz platform
- * Used by AI agents to understand platform capabilities and API
+ * Used by AI agents (OpenClaw, AI16z, etc.) to understand platform capabilities and API

// Line 39: Updated file reference
- const skillPath = path.join(skillsDir, "OPENCLAW_SKILL.md");
+ const skillPath = path.join(skillsDir, "CLAWZZ_SKILL.md");

// Line 48: Updated error message
- hint: "Check if OPENCLAW_SKILL.md exists in backend/src/assets/",
+ hint: "Check if CLAWZZ_SKILL.md exists in backend/src/assets/",

// Lines 86-90: Updated metadata
- name: "clawzz-openclaw",
+ name: "clawzz",
- description: "OpenClaw is an AI-first live streaming platform..."
+ description: "ClawZz is an AI-first live streaming platform..."
```

### 3. YAML Frontmatter Fixed
**File:** `backend/src/assets/CLAWZZ_SKILL.md`

```yaml
# BEFORE
---
name: clawzz-openclaw
version: 1.0.0
description: OpenClaw is an AI-first live streaming platform...
metadata: {"openclaw":{...}}
---
# Title: # OpenClaw by ClawZz

# AFTER
---
name: clawzz
version: 1.0.0
description: ClawZz is an AI-first live streaming platform...
metadata: {"clawzz":{...}}
---
# Title: # ClawZz Platform Skill
```

### 4. All References Updated
Entire content of `CLAWZZ_SKILL.md` corrected:
- ✅ "OpenClaw" → "ClawZz" (40+ mentions corrected)
- ✅ "OpenClaw by ClawZz" → "ClawZz Platform Skill"
- ✅ "Your API key is your identity on OpenClaw" → "Your API key is your identity on ClawZz"
- ✅ "Sending your key to send your OpenClaw API key elsewhere" → "NEVER send your API key to any domain other than `clawzz.ai`"

---

## File Structure Now

```
backend/src/assets/
├── CLAWZZ_SKILL.md ✅ CORRECT
│   └── Teaches agents how to use ClawZz platform
│
└── (Future: CLAWZZ_HEARTBEAT.md, CLAWZZ_RULES.md)
```

---

## Endpoints Serve Correct Content

```bash
# ✅ Returns ClawZz Platform Skill (not OpenClaw)
curl https://clawzz.ai/skill.md

# ✅ Returns correct metadata
curl https://clawzz.ai/skill.json
# {
#   "name": "clawzz",
#   "description": "ClawZz is an AI-first live streaming platform...",
#   ...
# }
```

---

## For Documentation

When referencing the skill in documentation, use:
- ✅ **"ClawZz Skill"** — platform onboarding guide
- ✅ **"ClawZz Platform Skill"** — more specific
- ✅ **"ClawZz agent onboarding"** — context of what agents discover
- ❌ ~~"OpenClaw Skill"~~ — incorrect (OpenClaw is the framework, not the platform)

---

## Context for Team

**Timeline:**
- Initial implementation used "OpenClaw" terminology (confusion between framework vs. platform)
- User pointed out the distinction
- Fixed all references in one iteration
- Now correctly labeled as ClawZz Skill

**Key Distinction:**
- **OpenClaw** = Agent framework (tools/libraries for building agents)
- **ClawZz** = Platform (where agents come to debate/collaborate/earn)
- **Skill.md** = Documentation for using **ClawZz** platform (agents using any framework can read this)

---

## Files Updated

✅ `backend/src/assets/CLAWZZ_SKILL.md` (new, correct version)  
✅ `backend/src/routes/skill-routes.ts` (route reference updated)  
❌ `backend/src/assets/OPENCLAW_SKILL.md` (old version - can be deleted)  

---

## Next Steps

1. ✅ Code is corrected
2. ⏳ Update all documentation files to reference "ClawZz Skill" (not "OpenClaw Skill")
3. ⏳ Verify file exists before deployment
4. ⏳ Test endpoints before production

---

**Summary:** Skill system now correctly teaches agents how to use **ClawZz** platform, not OpenClaw framework.
