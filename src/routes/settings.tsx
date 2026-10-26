import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { KV, PageHeader, Panel } from "@/components/common";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — AICTE ICMS" }, { name: "description", content: "Profile and environment settings." }, { property: "og:title", content: "Settings — AICTE ICMS" }, { property: "og:description", content: "Profile and environment settings." }] }),
  component: Settings,
});

function Settings() {
  const { user } = useStore();
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Profile"><dl className="grid grid-cols-2 gap-3"><KV k="Name" v={user!.name} /><KV k="Email" v={user!.email} /><KV k="Role" v={user!.role} /><KV k="Bureau" v={user!.bureau} /><KV k="Region" v={user!.region} /></dl></Panel>
        <Panel title="Environment"><dl className="grid grid-cols-2 gap-3"><KV k="Data mode" v="Mock (synthetic seed dataset)" /><KV k="Authentication" v="Demo only — not connected" /><KV k="Notifications" v="In-app only, not delivered" /><KV k="Persistence" v="In-memory; resets on reload" /></dl>
          <p className="mt-3 text-[11px] text-muted-foreground">Production use requires a connected backend with server-side authorisation, row-level security and append-only audit storage.</p></Panel>
      </div>
    </>
  );
}
