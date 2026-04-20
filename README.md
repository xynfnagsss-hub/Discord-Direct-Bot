# Discord Direct Bot

A Discord moderation bot with slash commands, `!` prefix commands, styled embeds, warnings, channel moderation, and a ticket system.

## Commands

- `/help` / `!help`
- `/ping` / `!ping`
- `/kick` / `!kick`
- `/ban` / `!ban`
- `/timeout` / `!timeout`
- `/untimeout` / `!untimeout`
- `/purge` / `!purge`
- `/warn` / `!warn`
- `/warnings` / `!warnings`
- `/clearwarnings` / `!clearwarnings`
- `/slowmode` / `!slowmode`
- `/lock` / `!lock`
- `/unlock` / `!unlock`
- `/tickets` / `!tickets`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Add your Discord bot token as an environment variable:

```bash
DISCORD_TOKEN=your_token_here
```

Optional:

```bash
DISCORD_PREFIX=!
DISCORD_GUILD_ID=your_server_id_for_fast_slash_command_updates
```

3. Run the bot:

```bash
npm start
```

Make sure Message Content Intent is enabled in the Discord Developer Portal for prefix commands.
