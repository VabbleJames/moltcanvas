# OpenClaw Security Update Required

**Current Version:** 2026.1.29  
**Latest Version:** v2026.2.1  
**Status:** ⚠️ UPDATES AVAILABLE (including security patches)

---

## Security Patches Available

The following security fixes are available in the upstream repository:

1. **fix/2692-whatsapp-accountid-path-traversal** - WhatsApp account ID path traversal vulnerability
2. **fix/3805-message-tool-sandbox-bypass** - Message tool sandbox bypass
3. **fix/lfi-media-parse** - Local file inclusion in media parsing
4. **fix/security-sanitize-env-vars** - Environment variable sanitization

---

## How to Update

### Option 1: Update to Latest Stable (Recommended)

```bash
cd /home/infi/moltbot
git stash  # Save any local changes
git pull origin main
git checkout v2026.2.1  # Latest stable tag
npm install  # Update dependencies
```

### Option 2: Merge Latest Main Branch

```bash
cd /home/infi/moltbot
git stash
git pull origin main
npm install
```

### After Update

```bash
# Restart OpenClaw gateway
openclaw gateway restart

# Or if running as service
systemctl restart openclaw
```

---

## What Gets Updated

- **Core OpenClaw:** Security patches, bug fixes
- **Dependencies:** npm packages (automatically via `npm install`)
- **Extensions:** Plugin updates
- **Skills:** No changes (your custom skills are safe)

---

## Local Changes Detection

Your `/home/infi/moltbot` directory has:
- **Deleted:** `.oxlintrc.json` 
- **Added:** `skills/moltbook/` (your custom skill - safe)

These won't conflict with updates.

---

## Rollback Plan (If Issues)

```bash
# Go back to previous version
cd /home/infi/moltbot
git checkout v2026.1.29
npm install
openclaw gateway restart
```

---

## Recommendation

**🔴 UPDATE NOW** - Security vulnerabilities exist in current version:
- Path traversal could expose files
- Sandbox bypass could allow unauthorized actions
- Environment variable leaks possible

**Update takes:** ~2-3 minutes  
**Downtime:** ~30 seconds (gateway restart)

---

## Steps to Update Right Now

1. **Backup current config:**
   ```bash
   cp /home/infi/.openclaw/config.yaml /home/infi/.openclaw/config.yaml.backup
   ```

2. **Update OpenClaw:**
   ```bash
   cd /home/infi/moltbot
   git stash
   git pull origin main
   git checkout v2026.2.1
   npm install
   ```

3. **Restart gateway:**
   ```bash
   # If using systemctl
   systemctl restart openclaw
   
   # Or if manual
   pkill -f "node.*openclaw" && sleep 2 && openclaw gateway start
   ```

4. **Verify:**
   ```bash
   # Check version
   cat /home/infi/moltbot/package.json | grep version
   
   # Should show: "version": "2026.2.1"
   ```

---

## After Update

Test basic functionality:
1. Send WhatsApp message → Agent responds ✅
2. Check gateway logs → No errors ✅
3. MoltCanvas still working → API accessible ✅

---

**Want me to run the update for you?** I can execute these commands.
