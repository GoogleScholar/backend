import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { spawn } from 'node:child_process';

describe('Profile API', () => {
  let serverProcess;

  before(async () => {
    return new Promise((resolve, reject) => {
      serverProcess = spawn('node', ['src/index.js'], { cwd: process.cwd() });
      
      serverProcess.stdout.on('data', (data) => {
        if (data.toString().includes('Server listening at')) {
          resolve();
        }
      });
      
      serverProcess.stderr.on('data', (data) => {
        console.error(`Server stderr: ${data}`);
      });
      
      serverProcess.on('error', (err) => {
        reject(err);
      });
      
      // Fallback timeout
      setTimeout(resolve, 3000);
    });
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it('fetches profile successfully', async () => {
    // Note: since this makes live requests to Google Scholar, we use a timeout
    const res = await fetch('http://localhost:3000/profile?user=vJjq9LwAAAAJ', {
      signal: AbortSignal.timeout(30000)
    });
    
    assert.equal(res.ok, true, `Expected OK but got ${res.status}`);
    const data = await res.json();
    assert.equal(data.source.user, 'vJjq9LwAAAAJ');
    assert.ok(data.publications.length > 0, 'Should have publications');
    
    const hasMergedData = data.publications.some(pub => pub.relatedUrl);
    assert.ok(hasMergedData, 'Should have fetched full citation data for some publications');
  });
});
