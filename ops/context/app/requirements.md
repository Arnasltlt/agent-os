# Requirements — app context source

Status: **needs_setup**

This source is the main website application being actively developed. The
`edit-app` action is active and agents may edit the provisional local path.
One item is outstanding before this source is fully complete.

---

## Outstanding: Canonical Git Remote URL

**Blocker for full `active` status.**

No canonical git remote URL was provided when this source was onboarded.
A repository source must have a durable remote URL (not a machine-local path)
so that:

- The `context/app/repo/` snapshot can be refreshed via `git clone`
- Agents can `git pull` before editing and open pull requests when done
- The source identity is portable across machines

**To complete setup:**

1. Determine the canonical remote URL, e.g.:
   - `https://github.com/your-org/agent-os.git`
   - `git@github.com:your-org/agent-os.git`

2. Update `context/app/source.yml`:
   ```yaml
   remote_url: "https://github.com/your-org/agent-os.git"
   status: active
   ```

3. Update `actions/edit-app/action.yml`:
   ```yaml
   target:
     remote_url: "https://github.com/your-org/agent-os.git"
   ```

4. Optionally refresh the local snapshot:
   ```bash
   cd context/app
   git clone https://github.com/your-org/agent-os.git repo
   ```

---

## Access Note

Until the remote URL is set, agents editing the app must be granted access to:

```
/Users/seima/Documents/cursor/agent-os/app
```

This is the provisional writable path recorded in `actions/edit-app/action.yml`.

---

## No Secrets Required

No API keys, tokens, or passwords are needed to read or build the application.
