# Display App Communication Flows - Visual Diagrams

This document contains visual flow diagrams for all major communication patterns between the Display App and the Backend.

---

## Table of Contents

1. [Device Pairing Flow](#device-pairing-flow)
2. [Initial Setup Flow](#initial-setup-flow)
3. [Normal Operation Flow](#normal-operation-flow)
4. [Emergency Alert Flow](#emergency-alert-flow)
5. [Remote Command Flow](#remote-command-flow)
6. [Content Update Flow](#content-update-flow)
7. [Prayer Times Update Flow](#prayer-times-update-flow)
8. [WebSocket Reconnection Flow](#websocket-reconnection-flow)
9. [Offline Detection Flow](#offline-detection-flow)
10. [Error Handling Flow](#error-handling-flow)

---

## Device Pairing Flow

```mermaid
sequenceDiagram
    participant D as Display App
    participant API as API Server
    participant DB as Database
    participant A as Admin Portal

    D->>API: POST /api/screens/unpaired
    Note over D,API: Request pairing code
    
    API->>DB: Create screen with PAIRING status
    DB-->>API: Screen created
    API-->>D: { pairingCode: "123456", expiresAt }
    
    Note over D: Display code on screen
    
    loop Poll every 3-5 seconds
        D->>API: POST /api/screens/check-simple
        Note over D,API: Check if admin paired
        API->>DB: Check screen status
        DB-->>API: Status: PAIRING, masjidId: null
        API-->>D: { isPaired: false }
    end
    
    Note over A: Admin enters code
    A->>API: POST /api/screens/pair
    API->>DB: Update screen with masjidId
    DB-->>API: Screen updated
    API-->>A: Pairing successful
    
    D->>API: POST /api/screens/check-simple
    API->>DB: Check screen status
    DB-->>API: Status: PAIRING, masjidId: set
    API-->>D: { isPaired: true, needsDevicePairing: true }
    
    D->>API: POST /api/screens/paired-credentials
    Note over D,API: Get API key
    API->>DB: Get screen credentials
    DB-->>API: { apiKey, screenId, masjidId }
    API-->>D: Credentials
    
    Note over D: Store credentials securely
    Note over D: Connect WebSocket & start API loops
```

---

## Initial Setup Flow

```mermaid
flowchart TD
    Start([Display App Starts]) --> CheckCreds{Check Local<br/>Credentials}
    
    CheckCreds -->|Found| ValidateCreds[Validate Credentials]
    CheckCreds -->|Not Found| StartPairing[Start Pairing Process]
    
    ValidateCreds --> TestAPI[Test API Call]
    TestAPI -->|Success| ConnectWS[Connect WebSocket]
    TestAPI -->|Failed| StartPairing
    
    StartPairing --> RequestCode[Request Pairing Code]
    RequestCode --> DisplayCode[Display Code on Screen]
    DisplayCode --> PollStatus[Poll Pairing Status]
    PollStatus -->|Not Paired| PollStatus
    PollStatus -->|Paired| GetCreds[Get Credentials]
    GetCreds --> StoreCreds[Store Securely]
    StoreCreds --> ConnectWS
    
    ConnectWS --> FetchContent[Fetch Initial Content]
    FetchContent --> StartLoops[Start Update Loops]
    StartLoops --> Ready([Display Ready])
    
    style Start fill:#90EE90
    style Ready fill:#90EE90
    style StartPairing fill:#FFE4B5
    style ConnectWS fill:#87CEEB
```

---

## Normal Operation Flow

```mermaid
flowchart LR
    subgraph Display["Display App"]
        WSClient[WebSocket Client]
        RESTClient[REST Client]
        Cache[Local Cache]
        Display1[Display Renderer]
    end
    
    subgraph Backend["Backend Services"]
        API[API Server]
        RT[Realtime Server]
        DB[(Database)]
    end
    
    RESTClient -->|30-60s| API
    RESTClient -.->|Heartbeat| API
    RESTClient -.->|Fetch Content| API
    RESTClient -.->|Prayer Status| API
    
    API <-->|Read/Write| DB
    
    WSClient <-->|Persistent| RT
    RT <-->|Pub/Sub| DB
    
    API -->|Response| Cache
    Cache --> Display1
    
    RT -->|Real-time Events| WSClient
    WSClient --> Display1
    
    style Display fill:#E6F3FF
    style Backend fill:#FFE6E6
```

---

## Emergency Alert Flow

```mermaid
sequenceDiagram
    participant A as Admin Portal
    participant API as API Server
    participant RT as Realtime Server
    participant D as Display App
    participant UI as Display UI

    A->>API: POST /api/displays/emergency
    Note over A,API: Trigger emergency alert
    
    API->>API: Create EmergencyAnnouncement
    API->>API: Calculate expiry time
    API-->>A: Alert created
    
    API->>RT: Publish emergency event
    Note over API,RT: Via publishEmergencyAlert()
    
    RT->>D: WebSocket: EMERGENCY_ALERT
    Note over RT,D: { action: 'show', title, message, color }
    
    D->>UI: Show full-screen alert
    Note over D,UI: Interrupt all content
    
    D->>RT: display:command:ack
    Note over D,RT: Acknowledge receipt
    
    RT->>A: screen:metrics
    Note over RT,A: Alert delivered confirmation
    
    Note over UI: Auto-close after duration
    
    A->>API: DELETE /api/displays/emergency
    Note over A,API: Deactivate alert
    
    API->>RT: Publish clear event
    RT->>D: WebSocket: EMERGENCY_ALERT
    Note over RT,D: { action: 'clear' }
    
    D->>UI: Remove alert
    Note over D,UI: Resume normal content
```

---

## Remote Command Flow

```mermaid
sequenceDiagram
    participant A as Admin Portal
    participant API as API Server
    participant Q as Command Queue
    participant D as Display App
    participant E as Executor

    A->>API: POST /api/displays/[screenId]/commands
    Note over A,API: Send command (e.g., RELOAD_CONTENT)
    
    API->>Q: Queue command
    Note over API,Q: Store in SSEQueue table
    Q-->>API: Command queued
    API-->>A: Command sent
    
    Note over D: Regular heartbeat cycle
    D->>API: POST /api/screen/heartbeat
    
    API->>Q: Get pending commands
    Q-->>API: Command list
    
    API-->>D: { pendingCommands: [...] }
    Note over API,D: Include _queueId for ack
    
    D->>E: Execute command
    Note over D,E: RELOAD_CONTENT
    
    E->>E: Fetch latest content
    E-->>D: Execution complete
    
    D->>API: POST /api/screen/heartbeat
    Note over D,API: Include commandAcknowledgements
    
    API->>Q: Mark command delivered
    Note over API,Q: Update deliveredAt
    
    API-->>D: Acknowledgement recorded
    
    API->>A: WebSocket: screen:command:completed
    Note over API,A: Notify admin of completion
```

---

## Content Update Flow

```mermaid
sequenceDiagram
    participant D as Display App
    participant Cache as Local Cache
    participant API as API Server
    participant DB as Database
    
    Note over D: Content update cycle (5-15 mins)
    
    D->>API: GET /api/screen/sync?screenId=...
    Note over D,API: Check for updates
    
    API->>DB: Query last update timestamps
    DB-->>API: Timestamps
    API-->>D: { prayerTimes, content, screen, overrides }
    
    D->>Cache: Get cached timestamps
    Cache-->>D: Cached timestamps
    
    D->>D: Compare timestamps
    
    alt Content has been updated
        D->>API: GET /api/screen/content?screenId=...
        Note over D,API: Fetch fresh content
        
        API->>DB: Query content, schedule, events
        DB-->>API: Content data
        
        API-->>D: Full content response
        
        D->>Cache: Update cache
        Note over D,Cache: Store with new timestamp
        
        D->>D: Refresh display
    else Content is up to date
        Note over D: Use cached content
    end
```

---

## Prayer Times Update Flow

```mermaid
flowchart TD
    Start([Daily Timer / App Start]) --> CheckDate{Check if<br/>new day?}
    
    CheckDate -->|No| UseCache[Use Cached Prayer Times]
    CheckDate -->|Yes| FetchNew[Fetch New Prayer Times]
    
    FetchNew --> API[GET /api/screen/prayer-times]
    API --> Range[Request 7 days]
    Range --> Response{Success?}
    
    Response -->|Yes| Cache[Cache Prayer Times]
    Response -->|No| Retry{Retry<br/>Count < 3?}
    
    Retry -->|Yes| Backoff[Exponential Backoff]
    Backoff --> API
    Retry -->|No| UseCache
    
    Cache --> UpdateDisplay[Update Display]
    UseCache --> UpdateDisplay
    UpdateDisplay --> SetTimer[Set Timer for Midnight]
    SetTimer --> End([Done])
    
    style Start fill:#90EE90
    style End fill:#90EE90
    style UpdateDisplay fill:#87CEEB
```

---

## WebSocket Reconnection Flow

```mermaid
stateDiagram-v2
    [*] --> Connecting: Connect
    
    Connecting --> Connected: Success
    Connecting --> Error: Failure
    
    Connected --> Disconnected: Connection Lost
    Connected --> Error: Error
    Connected --> [*]: App Closed
    
    Disconnected --> Reconnecting: Auto Retry
    
    Reconnecting --> Connected: Success
    Reconnecting --> Reconnecting: Failed (backoff)
    Reconnecting --> Failed: Max Attempts
    
    Error --> Reconnecting: Retry
    
    Failed --> ManualRetry: User Action
    ManualRetry --> Connecting
    
    note right of Connected
        - Send heartbeat every 30s
        - Listen for events
        - Mark as online
    end note
    
    note right of Reconnecting
        - Exponential backoff
        - 1s, 2s, 4s, 8s...
        - Max 30s delay
    end note
    
    note right of Disconnected
        - Use cached content
        - Show offline indicator
        - Queue outgoing events
    end note
```

---

## Offline Detection Flow

```mermaid
flowchart TD
    Start([Network Event / Failed Request]) --> CheckNetwork{Network<br/>Available?}
    
    CheckNetwork -->|Yes| TestAPI[Test API Endpoint]
    CheckNetwork -->|No| GoOffline[Enter Offline Mode]
    
    TestAPI -->|Success| Online[Online Mode]
    TestAPI -->|Failed| GoOffline
    
    Online --> HideIndicator[Hide Offline Indicator]
    Online --> ConnectWS[Connect WebSocket]
    Online --> FetchContent[Fetch Fresh Content]
    Online --> NormalOps[Normal Operations]
    
    GoOffline --> ShowIndicator[Show Offline Indicator]
    GoOffline --> DisconnectWS[Disconnect WebSocket]
    GoOffline --> UseCache[Use Cached Content]
    GoOffline --> QueueEvents[Queue Outgoing Events]
    
    NormalOps --> Monitor[Monitor Connection]
    Monitor --> CheckNetwork
    
    QueueEvents --> PollNetwork[Poll Network Every 30s]
    PollNetwork --> CheckNetwork
    
    style Online fill:#90EE90
    style GoOffline fill:#FFB6C1
    style UseCache fill:#FFE4B5
```

---

## Error Handling Flow

```mermaid
flowchart TD
    Start([Error Occurred]) --> Classify{Error Type?}
    
    Classify -->|Network| NetworkErr[Network Error]
    Classify -->|401| AuthErr[Authentication Error]
    Classify -->|429| RateLimit[Rate Limit]
    Classify -->|500| ServerErr[Server Error]
    Classify -->|Other| OtherErr[Other Error]
    
    NetworkErr --> CheckOnline{Online?}
    CheckOnline -->|No| OfflineMode[Offline Mode]
    CheckOnline -->|Yes| RetryNet[Retry with Backoff]
    
    AuthErr --> ClearCreds[Clear Credentials]
    ClearCreds --> StartPairing[Restart Pairing]
    
    RateLimit --> Backoff[Exponential Backoff]
    Backoff --> RetryReq[Retry Request]
    
    ServerErr --> RetryCount{Retry < 3?}
    RetryCount -->|Yes| RetryBackoff[Retry with Backoff]
    RetryCount -->|No| UseCache[Use Cache]
    
    OtherErr --> LogError[Log Error]
    LogError --> ReportBackend[Report to Backend]
    ReportBackend --> ShowUser[Show User Message]
    
    OfflineMode --> End([Continue with Cache])
    RetryNet --> End
    StartPairing --> End
    RetryReq --> End
    UseCache --> End
    ShowUser --> End
    
    style Start fill:#FFB6C1
    style End fill:#90EE90
    style AuthErr fill:#FF6347
    style OfflineMode fill:#FFE4B5
```

---

## Heartbeat Cycle

```mermaid
sequenceDiagram
    participant T as Timer
    participant D as Display App
    participant M as Metrics
    participant API as API Server
    participant E as Executor

    loop Every 30-60 seconds
        T->>D: Trigger heartbeat
        
        D->>M: Collect metrics
        M-->>D: CPU, Memory, Network, etc.
        
        D->>API: POST /api/screen/heartbeat
        Note over D,API: { status, metrics, acks }
        
        API->>API: Update screen status
        API->>API: Mark commands delivered
        API->>API: Get pending commands
        
        API-->>D: { acknowledged, pendingCommands }
        
        alt Has pending commands
            D->>E: Execute commands
            Note over D,E: Queue for next heartbeat ack
        end
        
        D->>D: Update heartbeat interval
        Note over D: 5s if commands, 30s otherwise
    end
```

---

## Prayer Status Update Cycle

```mermaid
flowchart LR
    subgraph Timer["Update Loop (60s)"]
        Start([Timer Tick]) --> Fetch
    end
    
    subgraph Fetch["Fetch Prayer Status"]
        API[GET /api/screen/prayer-status]
        API --> Parse[Parse Response]
    end
    
    subgraph Calculate["Calculate Display"]
        Parse --> Current[Current Prayer]
        Parse --> Next[Next Prayer]
        Parse --> Countdown[Countdown Timers]
    end
    
    subgraph Update["Update UI"]
        Current --> Display1[Prayer Name]
        Next --> Display2[Next Prayer]
        Countdown --> Display3[Time Remaining]
        
        Display3 --> LocalTimer[Start Local Timer]
        LocalTimer --> SecondTick[Update Every Second]
    end
    
    SecondTick --> Display3
    Display1 --> CheckMinute{New Minute?}
    CheckMinute -->|Yes| Start
    
    style Timer fill:#E6F3FF
    style Fetch fill:#FFE6F3
    style Calculate fill:#E6FFE6
    style Update fill:#FFFFE6
```

---

## Content Rotation Cycle

```mermaid
stateDiagram-v2
    [*] --> FetchSchedule: Load Schedule
    
    FetchSchedule --> Item1: Start Rotation
    
    Item1 --> Item2: Duration Elapsed
    Item2 --> Item3: Duration Elapsed
    Item3 --> Item1: Duration Elapsed
    
    state Item1 {
        [*] --> Display1
        Display1 --> Transition1: Duration - 1s
        Transition1 --> [*]: Fade Out
    }
    
    state Item2 {
        [*] --> Display2
        Display2 --> Transition2: Duration - 1s
        Transition2 --> [*]: Fade Out
    }
    
    state Item3 {
        [*] --> Display3
        Display3 --> Transition3: Duration - 1s
        Transition3 --> [*]: Fade Out
    }
    
    Item1 --> Emergency: Emergency Alert
    Item2 --> Emergency: Emergency Alert
    Item3 --> Emergency: Emergency Alert
    
    state Emergency {
        [*] --> ShowAlert
        ShowAlert --> [*]: Alert Cleared
    }
    
    Emergency --> Item1: Resume Rotation
    
    note right of Emergency
        Emergency alerts interrupt
        normal content rotation
    end note
```

---

## Complete System Architecture

```mermaid
graph TB
    subgraph Display["Display App (Electron)"]
        UI[Display UI]
        WSC[WebSocket Client]
        REST[REST Client]
        Cache[(Local Cache)]
        Metrics[Metrics Collector]
    end
    
    subgraph Backend["Backend Services"]
        API[API Server<br/>Next.js]
        RT[Realtime Server<br/>Socket.io]
        DB[(PostgreSQL<br/>Database)]
    end
    
    subgraph Admin["Admin Portal"]
        AUI[Admin UI]
        AWS[WebSocket Client]
    end
    
    UI -->|Display| Content[Content Renderer]
    UI -->|Show| Alerts[Emergency Alerts]
    UI -->|Update| Prayers[Prayer Times]
    
    WSC <-->|WSS| RT
    REST -->|HTTPS| API
    
    Cache -->|Read| UI
    REST -->|Write| Cache
    
    Metrics -->|Report| REST
    Metrics -->|Report| WSC
    
    RT <-->|Pub/Sub| DB
    API <-->|Read/Write| DB
    
    AWS <-->|WSS| RT
    AUI -->|HTTPS| API
    
    API -.->|Notify| RT
    RT -.->|Broadcast| WSC
    RT -.->|Broadcast| AWS
    
    style Display fill:#E6F3FF
    style Backend fill:#FFE6E6
    style Admin fill:#E6FFE6
```

---

## Summary

These flow diagrams provide a visual representation of how the Display App communicates with the backend. Key takeaways:

1. **Two channels**: REST API for data, WebSocket for real-time events
2. **Resilient**: Automatic reconnection, offline mode, caching
3. **Efficient**: Smart polling, sync checks, exponential backoff
4. **Secure**: Encrypted credentials, authentication at all levels
5. **Real-time**: Emergency alerts and commands delivered instantly

For detailed implementation instructions, see the main documentation:
- [DISPLAY-BACKEND-COMMUNICATION.md](./DISPLAY-BACKEND-COMMUNICATION.md)
- [QUICK-REFERENCE.md](./QUICK-REFERENCE.md)

**Last Updated:** 26 December 2025

