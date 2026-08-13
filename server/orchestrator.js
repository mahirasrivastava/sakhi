// orchestrator.js
// Coordinates Intake -> Triage -> Routing and produces one transparent,
// auditable session record. This is the single object the clinician/ASHA
// dashboard, the result card, and the audit log all read from.

import { nanoid } from "nanoid";
import { runIntake } from "./agents/intakeAgent.js";
import { runTriage } from "./agents/triageAgent.js";
import { runRouting } from "./agents/routingAgent.js";
import { retrieveSelfCare } from "./rag.js";
import { addSession } from "./store.js";

export async function runSession(rawInput) {
  const intake = runIntake(rawInput);
  const triage = await runTriage(intake);
  const routing = runRouting(triage, intake);
  const selfCare = triage.level === "self-care" || triage.level === "routine"
    ? retrieveSelfCare(intake, intake.language)
    : null;

  const session = {
    id: nanoid(10),
    createdAt: new Date().toISOString(),
    language: intake.language,
    intake,
    triage,
    routing,
    selfCare,
  };

  addSession(session);
  return session;
}
