import { readFile, writeFile, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(process.cwd());
const chromeDir = path.join(workspaceRoot, 'chrome');
const outputPath = path.join(workspaceRoot, 'public', 'app-config.json');

async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function parseEnvFile(content) {
  const config = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const [key, ...valueParts] = line.split('=');
    const envKey = key.trim();
    const value = valueParts.join('=').trim();

    if (envKey && value) {
      config[envKey] = value;
    }
  }

  return config;
}

async function loadEnvConfig() {
  const envPaths = [path.join(chromeDir, '.env'), path.join(chromeDir, '.env.local')];

  for (const envPath of envPaths) {
    if (!(await fileExists(envPath))) {
      continue;
    }

    const content = await readFile(envPath, 'utf8');
    const config = parseEnvFile(content);
    if (config.FIREBASE_API_KEY && !config.FIREBASE_API_KEY.includes('your_')) {
      return config;
    }
  }

  throw new Error('No se encontró una configuración válida en chrome/.env ni chrome/.env.local');
}

function buildRuntimeConfig(envConfig) {
  return {
    firebase: {
      apiKey: envConfig.FIREBASE_API_KEY,
      authDomain: envConfig.FIREBASE_AUTH_DOMAIN,
      projectId: envConfig.FIREBASE_PROJECT_ID,
      storageBucket: envConfig.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: envConfig.FIREBASE_MESSAGING_SENDER_ID,
      appId: envConfig.FIREBASE_APP_ID,
      measurementId: envConfig.FIREBASE_MEASUREMENT_ID || ''
    }
  };
}

async function main() {
  const envConfig = await loadEnvConfig();
  const runtimeConfig = buildRuntimeConfig(envConfig);

  await writeFile(outputPath, `${JSON.stringify(runtimeConfig, null, 2)}\n`, 'utf8');
  console.log(`[generate-app-config] Wrote ${path.relative(workspaceRoot, outputPath)}`);
}

main().catch((error) => {
  console.error('[generate-app-config] Failed:', error.message);
  process.exitCode = 1;
});