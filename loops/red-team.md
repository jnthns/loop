# Loop: red-team (devil's advocate)

Before committing to an architecture, rollout, or risky change, have a critic
argue it's wrong — and force each high-impact objection to be fixed or explicitly
accepted with reasons.

## Contract

- **End state:** no unresolved high-impact objection remains; each is either
  fixed or has a documented, reasoned acceptance.
- **Evidence required:** an objection log where every high-impact item has status
  `fixed` (with the change) or `accepted` (with the rationale and owner).
- **Constraints:** the critic must be adversarial and independent of the author,
  and trust evidence over confidence. Stop generating objections when they repeat
  without new evidence — don't manufacture noise.
- **Budget:** stop after `MAX_ITERATIONS` passes or `BUDGET_USD`.

## The five parts

| Part        | Answer                                                                      |
| ----------- | ------------------------------------------------------------------------- |
| **Trigger** | Manual, before locking a design/rollout decision.                          |
| **Inputs**  | The proposed design/plan doc + relevant code/constraints.                   |
| **Action**  | Raise the single strongest un-addressed objection, then resolve it.         |
| **Check**   | Objection log: high-impact items all `fixed` or `accepted` with reasons.    |
| **Stop**    | No open high-impact objections ✅ / objections repeat w/o new evidence 🟰 / needs human decision 🙋 / budget 🛑 |

## Prompt (run each pass)

> Fresh context, adversarial stance. Read the proposed architecture/plan. As an
> independent critic, argue it is wrong: raise the single strongest objection not
> already in the log — failure modes, scaling limits, security/privacy, cost,
> reversibility, operational burden, wrong assumptions. Log it with an impact
> rating. Then, as the builder, either fix the design to address it (record the
> change) or explicitly accept the risk with a written rationale and owner. Repeat
> until no high-impact objection is open, or the same objections recur without new
> evidence. Escalate genuine product/business trade-offs to a human. Keep the log
> in `memory/handoff.md` (or a decision record).

## Hard stops

- Max iterations: `${MAX_ITERATIONS}` · No-progress: `${MAX_NO_PROGRESS}` · Budget: `${BUDGET_USD}`.
