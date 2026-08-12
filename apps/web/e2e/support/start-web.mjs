import { cp } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const childEnvironment = { ...process.env };

for (const sensitiveName of [
  'E2E_AUTH_RATE_LIMIT_SECRET',
  'E2E_AUTH_STATE_FILE',
  'E2E_AUTH_USER_ID',
  'E2E_LOGIN_EMAIL',
  'E2E_LOGIN_PASSWORD',
  'E2E_LOGIN_TOTP_SECRET',
  'SECRET_KEY',
  'SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]) {
  delete childEnvironment[sensitiveName];
}

function run(command, arguments_, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      ...options,
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} a quitté avec ${signal ? `le signal ${signal}` : `le code ${code}`}`,
        ),
      );
    });
  });
}

await run('pnpm', ['build'], { env: childEnvironment });

await cp('.next/static', '.next/standalone/apps/web/.next/static', {
  recursive: true,
});

const server = spawn(
  process.execPath,
  ['.next/standalone/apps/web/server.js'],
  {
    env: { ...childEnvironment, HOSTNAME: '127.0.0.1' },
    stdio: 'inherit',
  },
);

function stopServer(signal) {
  server.kill(signal);
}

process.on('SIGINT', () => stopServer('SIGINT'));
process.on('SIGTERM', () => stopServer('SIGTERM'));
server.once('error', (error) => {
  throw error;
});
server.once('exit', (code) => process.exit(code ?? 1));
