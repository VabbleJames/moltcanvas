# Rename Repository: daybreak → moltcanvas

**Current:** `VabbleJames/daybreak`  
**Target:** `VabbleJames/moltcanvas`

---

## 📋 What Needs to Change

### 1. **GitHub Repository Name** ⭐ (Do This First)

**Steps:**
1. Go to: https://github.com/VabbleJames/daybreak/settings
2. Scroll to "Repository name"
3. Change: `daybreak` → `moltcanvas`
4. Click "Rename"

**What GitHub does automatically:**
- ✅ Redirects old URL to new URL (for 6 months)
- ✅ Updates clone URLs
- ✅ Updates all GitHub-hosted URLs

**What breaks:**
- ⚠️ Local git remotes (need to update)
- ⚠️ Railway deployment connection (may need reconnect)
- ⚠️ Any hardcoded URLs in docs

---

### 2. **Local Git Remote** (After GitHub Rename)

**Current:**
```bash
origin  https://github.com/VabbleJames/daybreak.git
```

**Update to:**
```bash
cd /home/infi/.openclaw/workspace/daybreak
git remote set-url origin https://github.com/VabbleJames/moltcanvas.git
```

**Verify:**
```bash
git remote -v
# Should show: VabbleJames/moltcanvas.git
```

**Note:** GitHub redirects will work, but better to update explicitly.

---

### 3. **Railway Deployment Connection**

**Check if Railway needs update:**
- Railway may auto-follow the redirect
- Or may need to reconnect to new repo URL

**If Railway breaks:**
1. Go to Railway dashboard
2. Frontend service → Settings → GitHub Repo
3. Backend service → Settings → GitHub Repo
4. Reconnect to `VabbleJames/moltcanvas`

---

### 4. **Documentation Updates** (Files to Edit)

#### **High Priority (Referenced Externally):**

**README.md** (Line 174)
```markdown
# Current
- **GitHub:** https://github.com/VabbleJames/moltcanvas

# Already correct! ✅ No change needed
```

**PRE-OPENSOURCE-CHECKLIST.md** (Line 172)
```markdown
# Change
1. Go to: https://github.com/VabbleJames/daybreak/settings

# To
1. Go to: https://github.com/VabbleJames/moltcanvas/settings
```

#### **Low Priority (Internal Docs):**

**E2E-TESTING.md**
```markdown
# Change
cd daybreak/sdk/examples

# To
cd moltcanvas/sdk/examples
```

**PRE-OPENSOURCE-CHECKLIST.md** (Line 184)
```markdown
# Change
cd daybreak

# To
cd moltcanvas
```

**DEPLOY.md**
- Contains old Railway URL references
- Leave as historical documentation OR update with note

---

### 5. **Package Names** (Optional - Not Urgent)

#### **Frontend package.json**
```json
// Current
"name": "daybreak-frontend"

// Optional change to
"name": "moltcanvas-frontend"
```

**Impact:** None (internal package name, not published)  
**Priority:** Low

#### **Backend package.json**
Currently: No package name  
**Action:** None needed

#### **SDK package.json**
```json
// Current
"name": "daybreak-sdk"

// Change to
"name": "moltcanvas-sdk"
```

**Impact:** High if publishing to npm  
**Priority:** High (before PyPI publish)

---

### 6. **Code References** (Minimal Impact)

**CSS class names:**
```css
/* frontend/STRUCTURE.md has references like: */
'daybreak-bg': '#0a0a0f'
'daybreak-card': '#1a1a2e'

/* These are just documentation, not actual code */
```

**Pattern references in UI:**
```tsx
// frontend/src/app/patterns/page.tsx
border-daybreak-accent
text-daybreak-dim

/* These might be old Tailwind classes that aren't even used */
```

**Priority:** Low (check if they exist in actual code)

---

## 🎯 Recommended Order

### Phase 1: GitHub Rename (5 minutes)
1. ✅ Rename repo on GitHub: `daybreak` → `moltcanvas`
2. ✅ Update local git remote
3. ✅ Test: `git pull` (should work)
4. ✅ Test: `git push` (should work)

### Phase 2: Documentation (10 minutes)
1. ✅ Update `PRE-OPENSOURCE-CHECKLIST.md` (1 reference)
2. ✅ Update `E2E-TESTING.md` (1 reference)
3. ✅ Check `README.md` (already says "moltcanvas" ✅)
4. ✅ Commit changes

### Phase 3: Package Names (5 minutes)
1. ✅ Update SDK package.json: `daybreak-sdk` → `moltcanvas-sdk`
2. ✅ Update frontend package.json (optional): `daybreak-frontend` → `moltcanvas-frontend`
3. ✅ Commit changes

### Phase 4: Verify Railway (2 minutes)
1. ✅ Check Railway deployments still work
2. ✅ If broken, reconnect to new repo URL

**Total time:** ~20 minutes

---

## 🚨 What NOT to Change

### Keep "daybreak" in these contexts:
- [x] Historical commit messages
- [x] Old documentation referring to past state
- [x] DEPLOY.md (historical Railway project name)
- [x] Local folder name `/workspace/daybreak/` (can rename but not required)

### Don't rename local directory (optional)
```bash
# Current
/home/infi/.openclaw/workspace/daybreak/

# Could rename to
/home/infi/.openclaw/workspace/moltcanvas/

# But NOT REQUIRED - folder name doesn't matter
```

**Reason:** Git doesn't care about folder names, only remote URLs.

---

## ✅ Testing Checklist (After Rename)

After renaming, verify:

- [ ] `git remote -v` shows new URL
- [ ] `git pull` works
- [ ] `git push` works
- [ ] GitHub repo accessible at new URL
- [ ] Old URL redirects to new URL (GitHub auto-redirect)
- [ ] Railway frontend deploys
- [ ] Railway backend deploys
- [ ] Frontend loads: https://moltcanvas.app
- [ ] API responds: https://api.moltcanvas.app/health

---

## 🔧 Quick Commands (Copy-Paste)

### 1. Update Git Remote
```bash
cd /home/infi/.openclaw/workspace/daybreak
git remote set-url origin https://github.com/VabbleJames/moltcanvas.git
git remote -v  # Verify
```

### 2. Update SDK Package Name
```bash
cd /home/infi/.openclaw/workspace/daybreak/sdk
# Edit package.json: "name": "moltcanvas-sdk"
```

### 3. Update Documentation References
```bash
cd /home/infi/.openclaw/workspace/daybreak
# Edit PRE-OPENSOURCE-CHECKLIST.md
# Edit E2E-TESTING.md
```

### 4. Commit Changes
```bash
git add -A
git commit -m "Rename project: daybreak → moltcanvas (documentation, package names)"
git push
```

---

## 💡 Why This Is Easy

**GitHub makes it simple:**
- Old URLs redirect automatically
- Local repos keep working (with redirects)
- No data loss
- No broken links (for 6+ months)

**What's minimal:**
- Only ~5-10 doc references to update
- Package names are internal (not breaking)
- Code mostly says "MoltCanvas" already

---

## 🎉 After Completion

Once renamed:
- ✅ Repo will be at: `github.com/VabbleJames/moltcanvas`
- ✅ Can make it public with correct name
- ✅ SDK can reference correct repo
- ✅ Consistent branding everywhere

---

**Want me to do the rename for you?** I can execute all the commands.
