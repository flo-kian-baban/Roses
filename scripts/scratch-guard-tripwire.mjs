// Loaded with `node --import` by scripts/scratch-guard-selftest.mjs into the script under test: every outgoing connection (TCP or a local
// socket: an HTTP request, fetch, Postgres) and every child process (a browser, a server, docker, git) the script starts is written to
// TRIPWIRE_LOG, one JSON line each, and refused. A connection to TRIPWIRE_ALLOW_PORT (the selftest's own fake server, standing in for a
// target) is written and let through. So "the script sent nothing" is read from the log, not assumed.
import fs from 'node:fs';
import net from 'node:net';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';

const file = process.env.TRIPWIRE_LOG, allow = Number(process.env.TRIPWIRE_ALLOW_PORT || 0);
if (!file) throw new Error('TRIPWIRE_LOG is not set');
const note = (entry) => fs.appendFileSync(file, JSON.stringify({ at: Date.now(), ...entry }) + '\n');

const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function tripwireConnect(...a) {
  // net.connect() hands over its normalized arguments as one array; a direct socket.connect() call passes (options) or (port, host) or (path)
  const first = Array.isArray(a[0]) ? a[0][0] : a[0];
  const o = typeof first === 'object' && first !== null ? first : typeof first === 'string' && Number.isNaN(Number(first)) ? { path: first } : { port: first, host: a[1] };
  const target = o.path ? { path: String(o.path) } : { host: String(o.host ?? 'localhost'), port: Number(o.port) };
  if (!o.path && allow && target.port === allow) { note({ kind: 'connect', ...target, allowed: true }); return connect.apply(this, a); }
  note({ kind: 'connect', ...target, allowed: false });
  throw new Error(`tripwire: connection to ${o.path ?? `${target.host}:${target.port}`} refused by the scratch-guard selftest`);
};
for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
  cp[name] = function tripwireChild(command, ...rest) {
    note({ kind: 'child', via: name, command: String(command), args: Array.isArray(rest[0]) ? rest[0].map(String).slice(0, 6) : [] });
    throw new Error(`tripwire: child process "${command}" refused by the scratch-guard selftest`);
  };
}
syncBuiltinESMExports(); // `import { spawn } from 'node:child_process'` in the script under test sees the replacements
