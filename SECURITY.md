# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration holds, to help judge a report:

- **Nothing on disk**: it writes nothing under `/data`; its state (the last
  values sent, the events already fired) lives in memory and is rebuilt at
  start.
- **No secret**: it has no account, password, token or API key. Its only
  credential is the integration token Gladys gives the container, handled by
  the SDK and never logged.
- **The home location**: with the `location` authorization granted at install,
  it reads the coordinates of the houses of Gladys (or uses the ones typed in
  its configuration) to compute the times. They stay in memory, are never
  logged, and never leave the container except back to Gladys as computed
  times.
- **No network**: the container talks to Gladys only. It makes no request to
  Aladhan or any other service (`scripts/probe.mjs` does, but it is a
  development tool, not part of the image).

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and the third-party services the documentation mentions.
