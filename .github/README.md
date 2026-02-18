<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/uncord-chat/.github/main/profile/logo-banner-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/uncord-chat/.github/main/profile/logo-banner-light.png">
    <img alt="Uncord" src="https://raw.githubusercontent.com/uncord-chat/.github/main/profile/logo-banner-light.png" width="1280">
  </picture>
</p>

The React Native client for the [Uncord](https://github.com/uncord-chat) project. Built with Expo and runs on web, iOS, and Android from a single codebase.

### Tech stack

| Component         | Technology          |
| ----------------- | ------------------- |
| Framework         | React Native + Expo |
| Navigation        | Expo Router         |
| Language          | TypeScript          |
| Formatting / Lint | ESLint + Prettier   |

### Quick start

```bash
git clone https://github.com/uncord-chat/uncord-client.git
cd uncord-client
npm install
npx expo start
```

Then press `w` for web, `i` for iOS simulator, or `a` for Android emulator.

### Configuration

The client supports **multiple Uncord servers**. Add servers from within the app: open the app, tap "Add server", and enter the server base URL (e.g. `http://localhost:8080` or `https://chat.example.com`). You can add several servers and switch between them. Each server has its own login; register or log in per server.

### Development

```bash
npm run web            # start web dev server
npm run ios            # start iOS
npm run android        # start Android
npm run fmt            # format with Prettier
npm run lint           # lint with ESLint
npm run tsc            # TypeScript type check
npm test               # run tests
```

### Project structure

```
app/                   Expo Router screens and layouts
  (main)/              Authenticated app shell (sidebars, chat, settings)
  (servers)/           Server list and add-server flow
components/            Reusable UI components
  auth-panel/          Login, register, and MFA forms
  channel-sidebar/     Channel list with categories
  chat/                Message list, input, channel header
  common/              Shared primitives (Avatar, PresenceDot)
  layout/              Responsive shells, data providers, mobile drawer and header
  member-sidebar/      Member list and role group headers
  onboarding/          Onboarding flow (accept docs, verify email, join server)
  server-sidebar/      Server icon strip and context menu
  ui/                  UI primitives (collapsible, icon symbol)
constants/             Theme colours, layout breakpoints, config
hooks/                 Shared hooks (useIsDesktop, useColorScheme, etc.)
lib/                   Core logic
  api/                 REST API client with typed responses
  auth/                Auth context, token storage (SecureStore / sessionStorage)
  gateway/             WebSocket gateway client, context, and event hooks
  members/             Member context and channel member hooks
  messages/            Channel message fetching and state
  onboarding/          Onboarding context
  presence/            Presence context
  server-data/         Server config, channels, and categories context
  servers/             Persistent server list store
  typing/              Typing indicator hooks
assets/                Images, fonts
```

### Related repositories

| Repository                                                        | Description                                               |
|-------------------------------------------------------------------|-----------------------------------------------------------|
| [uncord-server](https://github.com/uncord-chat/uncord-server)     | Go server. REST API, WebSocket gateway, permission engine |
| [uncord-protocol](https://github.com/uncord-chat/uncord-protocol) | Shared types, permission constants, event definitions     |
| [uncord-docs](https://github.com/uncord-chat/uncord-docs)         | User and admin documentation                              |

### License

MIT
