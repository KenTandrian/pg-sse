export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface MultiplexerMessage {
  type: "query_leader" | "heartbeat" | "claim" | "release" | "status" | "event";
  senderId: string;
  payload?: unknown;
}

export class TabMultiplexer {
  private channel: BroadcastChannel | null = null;
  private tabId: string;
  private isLeader = false;
  private leaderId: string | null = null;
  private status: ConnectionStatus = "disconnected";

  private heartbeatInterval: NodeJS.Timeout | null = null;
  private watchdogTimeout: NodeJS.Timeout | null = null;
  private electionTimeout: NodeJS.Timeout | null = null;
  private eventSource: EventSource | null = null;

  private claimInProgress = false;

  constructor(
    private endpoint: string,
    private onEvent: (event: string, payload: unknown) => void,
    private onStatusChange: (
      status: ConnectionStatus,
      activeConnections: number,
    ) => void,
  ) {
    this.tabId = Math.random().toString(36).substring(2, 11);

    if (
      typeof window !== "undefined" &&
      typeof BroadcastChannel !== "undefined"
    ) {
      this.channel = new BroadcastChannel("pg-sse-multiplexer-channel");
      this.channel.onmessage = (event) => this.handleChannelMessage(event.data);

      // Hook window unload to release leadership if we close
      window.addEventListener("beforeunload", () => this.destroy());

      // Start a watchdog to claim leadership if no leader responds in 1.5 seconds
      this.resetWatchdog(1500);

      // Query if there is an existing leader
      this.broadcast({ type: "query_leader", senderId: this.tabId });
    } else {
      // Fallback for non-browser or environments without BroadcastChannel
      this.startDirectConnection();
    }
  }

  public destroy(): void {
    const wasLeader = this.isLeader;
    this.isLeader = false;

    if (wasLeader) {
      this.broadcast({ type: "release", senderId: this.tabId });
    }

    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.watchdogTimeout) clearTimeout(this.watchdogTimeout);
    if (this.electionTimeout) clearTimeout(this.electionTimeout);

    this.stopEventSource();

    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }

  private broadcast(msg: MultiplexerMessage): void {
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (e) {
        // Broadcast channel might be closed
      }
    }
  }

  private handleChannelMessage(msg: MultiplexerMessage): void {
    if (msg.senderId === this.tabId) return;

    switch (msg.type) {
      case "query_leader":
        if (this.isLeader) {
          this.sendHeartbeat();
        }
        break;

      case "heartbeat":
        this.claimInProgress = false;
        if (this.electionTimeout) {
          clearTimeout(this.electionTimeout);
          this.electionTimeout = null;
        }
        this.leaderId = msg.senderId;
        this.resetWatchdog(5000); // 5s watchdog
        break;

      case "claim":
        // Another tab wants to claim leadership.
        if (this.isLeader) {
          // Assert dominance immediately
          this.sendHeartbeat();
        } else if (this.claimInProgress) {
          // If we also want to claim, the one with lower lexicographical tabId wins
          if (msg.senderId < this.tabId) {
            // We lose the election, abort our claim
            this.claimInProgress = false;
            if (this.electionTimeout) {
              clearTimeout(this.electionTimeout);
              this.electionTimeout = null;
            }
          }
        }
        break;

      case "release":
        if (this.leaderId === msg.senderId) {
          this.leaderId = null;
          // Trigger immediate election
          this.attemptLeadershipClaim();
        }
        break;

      case "status":
        if (!this.isLeader && this.leaderId === msg.senderId) {
          const payloadObj = msg.payload as {
            status: ConnectionStatus;
            activeConnections: number;
          };
          this.status = payloadObj.status;
          this.onStatusChange(this.status, payloadObj.activeConnections);
        }
        break;

      case "event":
        if (!this.isLeader && this.leaderId === msg.senderId) {
          const payloadObj = msg.payload as { event: string; data: unknown };
          this.onEvent(payloadObj.event, payloadObj.data);
        }
        break;
    }
  }

  private resetWatchdog(ms: number): void {
    if (this.watchdogTimeout) clearTimeout(this.watchdogTimeout);
    this.watchdogTimeout = setTimeout(() => {
      this.attemptLeadershipClaim();
    }, ms);
  }

  private attemptLeadershipClaim(): void {
    if (this.isLeader || this.claimInProgress) return;

    this.claimInProgress = true;
    this.broadcast({ type: "claim", senderId: this.tabId });

    // Wait 500ms for objection (heartbeat or higher priority claim)
    this.electionTimeout = setTimeout(() => {
      this.electionTimeout = null;
      if (this.claimInProgress) {
        this.claimInProgress = false;
        this.becomeLeader();
      }
    }, 500);
  }

  private becomeLeader(): void {
    this.isLeader = true;
    this.leaderId = this.tabId;
    if (this.watchdogTimeout) {
      clearTimeout(this.watchdogTimeout);
      this.watchdogTimeout = null;
    }

    // Start heartbeat broadcasts
    this.sendHeartbeat();
    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), 2000);

    // Establish SSE EventSource
    this.startEventSource();
  }

  private sendHeartbeat(): void {
    this.broadcast({ type: "heartbeat", senderId: this.tabId });
  }

  private updateStatus(
    newStatus: ConnectionStatus,
    activeConnections = 0,
  ): void {
    this.status = newStatus;
    this.onStatusChange(newStatus, activeConnections);
    if (this.isLeader) {
      this.broadcast({
        type: "status",
        senderId: this.tabId,
        payload: { status: newStatus, activeConnections },
      });
    }
  }

  private startEventSource(): void {
    this.stopEventSource();
    this.updateStatus("connecting");

    try {
      this.eventSource = new EventSource(this.endpoint);

      this.eventSource.addEventListener("handshake", (e) => {
        try {
          const data = JSON.parse(e.data);
          this.updateStatus("connected", data.activeConnections || 1);
        } catch (err) {
          this.updateStatus("connected", 1);
        }
      });

      this.eventSource.addEventListener("notification", (e) => {
        try {
          const data = JSON.parse(e.data);
          this.onEvent("notification", data);
          this.broadcast({
            type: "event",
            senderId: this.tabId,
            payload: { event: "notification", data },
          });
        } catch (err) {
          // Parse error
        }
      });

      this.eventSource.onerror = () => {
        this.updateStatus("connecting");
      };
    } catch (err) {
      this.updateStatus("disconnected");
    }
  }

  private startDirectConnection(): void {
    // Non-browser fallback or single-tab mode
    this.startEventSource();
  }

  private stopEventSource(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
