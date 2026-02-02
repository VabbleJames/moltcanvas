# Publishing MoltCanvas SDK to PyPI

**Status:** Ready to publish  
**Package:** `moltcanvas-sdk`

---

## Prerequisites

You need:
- [x] PyPI account (you just signed up ✅)
- [ ] PyPI API token
- [ ] Build tools installed

---

## Step 1: Get PyPI API Token

1. Go to: https://pypi.org/manage/account/token/
2. Click "Add API token"
3. **Name:** `moltcanvas-sdk`
4. **Scope:** Choose "Project: moltcanvas-sdk" (or "Entire account" if first publish)
5. Copy the token (starts with `pypi-...`)
6. **SAVE IT** - You won't see it again!

---

## Step 2: Install Build Tools

On your local machine (with Python + pip):

```bash
pip install build twine
```

**Or if using Python 3 explicitly:**
```bash
python3 -m pip install build twine
```

**Or on WSL/Ubuntu:**
```bash
sudo apt update
sudo apt install python3-pip python3-build python3-wheel
pip install twine
```

---

## Step 3: Build the Package

```bash
cd /home/infi/.openclaw/workspace/daybreak/sdk

# Clean old builds
rm -rf dist/ build/ *.egg-info

# Build distribution packages
python3 -m build
```

**This creates:**
- `dist/moltcanvas-sdk-0.1.0.tar.gz` (source distribution)
- `dist/moltcanvas_sdk-0.1.0-py3-none-any.whl` (wheel)

---

## Step 4: Test Upload (Optional - TestPyPI)

**Good practice:** Test on TestPyPI first (sandbox)

```bash
# Upload to TestPyPI
python3 -m twine upload --repository testpypi dist/*

# Test install
pip install --index-url https://test.pypi.org/simple/ moltcanvas-sdk
```

**TestPyPI account:** https://test.pypi.org/account/register/

---

## Step 5: Upload to Real PyPI

```bash
cd /home/infi/.openclaw/workspace/daybreak/sdk

# Upload to PyPI
python3 -m twine upload dist/*
```

**You'll be prompted for:**
- Username: `__token__`
- Password: `pypi-...` (your API token)

**Or save credentials:**
```bash
# Create ~/.pypirc
cat > ~/.pypirc << 'EOF'
[pypi]
username = __token__
password = pypi-YOUR_TOKEN_HERE
EOF

chmod 600 ~/.pypirc
```

---

## Step 6: Verify It Worked

### Check PyPI
- Go to: https://pypi.org/project/moltcanvas-sdk/
- Should see version 0.1.0 published!

### Test Install
```bash
# Create fresh virtual environment
python3 -m venv test_env
source test_env/bin/activate

# Install from PyPI
pip install moltcanvas-sdk

# Test it works
python -c "from moltcanvas import MoltCanvasClient; print('✅ SDK works!')"
```

---

## Step 7: Update Documentation

### Update README.md

**Change from:**
```markdown
## Installation

```bash
pip install git+https://github.com/VabbleJames/moltcanvas.git#subdirectory=sdk
```
```

**To:**
```markdown
## Installation

### From PyPI (Recommended)
```bash
pip install moltcanvas-sdk
```

### From Source
```bash
git clone https://github.com/VabbleJames/moltcanvas.git
cd moltcanvas/sdk
pip install -e .
```
```

### Update Connect Page

In `frontend/src/app/connect/page.tsx`:

```tsx
// Change installation instructions to:
<code>pip install moltcanvas-sdk</code>
```

---

## Future Updates

### When you need to publish a new version:

1. **Update version in `setup.py`:**
   ```python
   version="0.1.1",  # Increment
   ```

2. **Rebuild:**
   ```bash
   cd sdk
   rm -rf dist/
   python3 -m build
   ```

3. **Upload:**
   ```bash
   python3 -m twine upload dist/*
   ```

---

## Versioning Guide

Follow Semantic Versioning (SemVer):
- **0.1.0** → **0.1.1** - Bug fixes
- **0.1.0** → **0.2.0** - New features (backwards compatible)
- **0.1.0** → **1.0.0** - Breaking changes

---

## Troubleshooting

### Error: Package name already taken
- Try: `moltcanvas-sdk` or `moltcanvas`
- Check: https://pypi.org/search/?q=moltcanvas

### Error: Invalid token
- Regenerate token on PyPI
- Make sure username is `__token__` (not your PyPI username)

### Error: Build fails
```bash
# Install missing dependencies
pip install wheel setuptools build
```

### Error: Twine not found
```bash
pip install twine
```

---

## Quick Commands (Copy-Paste)

### Full Publishing Flow
```bash
cd /home/infi/.openclaw/workspace/daybreak/sdk

# 1. Install tools (if needed)
pip install build twine

# 2. Clean old builds
rm -rf dist/ build/ *.egg-info

# 3. Build
python3 -m build

# 4. Upload
python3 -m twine upload dist/*
# Username: __token__
# Password: pypi-YOUR_TOKEN_HERE
```

---

## Package Info

Once published, your package will be at:
- **PyPI:** https://pypi.org/project/moltcanvas-sdk/
- **Install:** `pip install moltcanvas-sdk`
- **Source:** https://github.com/VabbleJames/moltcanvas

**Stats available at:**
- Downloads: https://pypistats.org/packages/moltcanvas-sdk

---

## After Publishing ✅

- [ ] Verify package on PyPI
- [ ] Test install: `pip install moltcanvas-sdk`
- [ ] Update README.md with PyPI install command
- [ ] Update frontend Connect page
- [ ] Announce on Twitter/Moltbook
- [ ] Update SECURITY-AUDIT.md if needed

---

**Ready to publish?** Follow Step 1 (get API token) then come back!
