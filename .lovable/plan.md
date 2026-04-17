

## Why agent 9497589094 isn't found

I checked the audit log — the bot **did** call `elife_get_agent_hierarchy({mobile: "9497589094"})` three times and got `"No agent records found."` each time. That tool is hardcoded to search tables named `agents`, `agent_hierarchy`, `users` — **none of which exist in e-Life**. e-Life actually stores agents in `pennyekart_agents` and `members`, and payments in `program_registrations` / `old_payments`.

The bridge is fully enabled with the right tables allowlisted (`pennyekart_agents`, `members`, `program_registrations`, `old_payments`, `whatsapp_bot_commands`, etc.) — only the tool implementations are looking in the wrong place.

## Fix Plan

### 1. Rewrite the typed e-Life tools in `supabase/functions/chat/index.ts`

Replace the hardcoded table lists with the real e-Life schema:

| Tool | Old tables searched | New tables searched |
|---|---|---|
| `elife_get_agent_hierarchy` | `agents`, `agent_hierarchy`, `users` | `pennyekart_agents`, `members` (with upline join) |
| `elife_check_payment_status` | `registrations`, `payments`, `customers` | `program_registrations`, `old_payments`, `members` |
| `elife_send_whatsapp_command` | `whatsapp_commands` | `whatsapp_bot_commands` |

Mobile-number matching will check **multiple column variants** (`mobile`, `mobile_number`, `phone`, `whatsapp_number`, `contact_number`) using `or(...)`, and normalize input by stripping `+91` / leading zeros.

### 2. Add a hierarchy enrichment step

For `elife_get_agent_hierarchy`: after finding the agent, also fetch their **upline** (referrer/parent agent) and **direct downline** (other agents whose `referrer_mobile` / `parent_id` matches), so the bot can answer "who is above/below me".

### 3. Improve the system prompt + tool descriptions

- Tell the AI: when a user gives a mobile number, **first** call `elife_get_agent_hierarchy`; if empty, fall back to `elife_query_table` against `members` and `program_registrations`.
- Update tool descriptions so the model knows which tables are actually used.

### 4. Auto-introspect column names (one-time, cached)

On first call per cold start, the function will hit `${ELIFE_URL}/rest/v1/pennyekart_agents?limit=0` to confirm the table exists and discover real column names from PostgREST headers. This protects against e-Life schema drift and avoids re-debugging this same issue later.

### 5. Verification

After deploy I'll call the chat function with mobile `9497589094` end-to-end and confirm the audit log shows a successful hierarchy result.

### Files changed
| File | Change |
|---|---|
| `supabase/functions/chat/index.ts` | Rewrite `elife_get_agent_hierarchy`, `elife_check_payment_status`, `elife_send_whatsapp_command`; refine prompts |

No DB migrations, no new secrets, no UI changes needed — the admin's allowlist already covers everything.

