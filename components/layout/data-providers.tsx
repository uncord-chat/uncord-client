import type { ReactNode } from "react";

import { GatewayProvider } from "@/lib/gateway/gateway-context";
import { MemberProvider } from "@/lib/members/member-context";
import { PresenceProvider } from "@/lib/presence/presence-context";
import { ServerDataProvider } from "@/lib/server-data/server-data-context";

type DataProvidersProps = {
  children: ReactNode;
};

/**
 * Wraps children in the data provider stack required for authenticated screens.
 * Extracted to reduce nesting complexity in the main layout.
 */
export function DataProviders({ children }: DataProvidersProps) {
  return (
    <ServerDataProvider>
      <GatewayProvider>
        <PresenceProvider>
          <MemberProvider>{children}</MemberProvider>
        </PresenceProvider>
      </GatewayProvider>
    </ServerDataProvider>
  );
}
