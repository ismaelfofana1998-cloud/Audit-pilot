import { AppShell } from "@/components/app-shell";
import { RequestManager } from "@/components/request-manager";
import { requirePageActor } from "@/lib/server/core";
import { getMembers, getMissions, getRequests } from "@/lib/server/queries";

export default async function RequestsPage() {
  const actor = await requirePageActor("/demandes");
  const [requests, missions, members] = await Promise.all([
    getRequests(actor),
    getMissions(actor),
    getMembers(actor),
  ]);
  return (
    <AppShell active="requests" title="Demandes client">
      <RequestManager
        initialRequests={requests as never[]}
        members={members.map((member) => ({ id: member.id, name: member.name }))}
        missions={missions.map((mission) => ({
          id: mission.id,
          name: mission.title,
        }))}
      />
    </AppShell>
  );
}
