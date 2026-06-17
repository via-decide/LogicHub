import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Ecosystem-Uid');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const VERSION = '141';

function injectVersioning(html) {
    const insertVersion = (p) => {
        const ext = path.extname(p);
        return p.slice(0, -ext.length) + `.v${VERSION}${ext}`;
    };
    return html
        .replace(/(href=")(?!https?:\/\/|\/\/)([^"\s]+\.css)(")/g, (m, p1, p2, p3) => `${p1}${insertVersion(p2)}${p3}`)
        .replace(/(src=")(?!https?:\/\/|\/\/)([^"\s]+\.js)(")/g, (m, p1, p2, p3) => `${p1}${insertVersion(p2)}${p3}`)
        .replace(/(href=")(?!https?:\/\/|\/\/)([^"\s]+manifest\.json)(")/g, (m, p1, p2, p3) => `${p1}${insertVersion(p2)}${p3}`)
        .replace(/register\(['"](?!\/\/|https?:\/\/)([^'"]+sw\.js)['"]\)/g, (m, p1) => `register('${insertVersion(p1)}')`);
}

function serveVersionedHTML(res) {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, 'utf8');
        html = injectVersioning(html);
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        return res.send(html);
    }
    res.status(404).send('Not Found');
}

// 1. Rewrite versioned requests to physical files and add long-cache headers
app.use((req, res, next) => {
    const match = req.url.match(/\.v(\d+)\.(js|css|json)$/);
    if (match) {
        const originalUrl = req.url;
        req.url = req.url.replace(/\.v\d+\.(js|css|json)$/, '.$1');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    next();
});

// Dynamic Route for Index to ensure version rewriting
app.get(['/', '/index.html'], (req, res) => {
    serveVersionedHTML(res);
});

// Onboarding clean URL (matches Vercel cleanUrls behaviour)
app.get(['/onboarding', '/onboarding.html'], (req, res) => {
    const onboardingPath = path.join(__dirname, 'onboarding.html');
    if (fs.existsSync(onboardingPath)) {
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        return res.send(fs.readFileSync(onboardingPath, 'utf8'));
    }
    res.status(404).send('Onboarding not found');
});

// /forge route → serve main app (post-onboarding destination)
app.get(['/forge', '/forge/*'], (req, res) => {
    serveVersionedHTML(res);
});

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Dynamic Vercel Serverless Function Emulator
app.use('/api', async (req, res) => {
    // req.path is like '/auth' (relative to /api)
    let funcPath = path.join(__dirname, 'api', req.path);
    
    if (fs.existsSync(funcPath) && fs.statSync(funcPath).isDirectory()) {
        funcPath = path.join(funcPath, 'index.js');
    } else if (!funcPath.endsWith('.js')) {
        funcPath += '.js';
    }

    if (fs.existsSync(funcPath)) {
        try {
            // Bypass Node's module cache for dynamic dev reload (optional)
            const cacheBust = `?update=${Date.now()}`;
            const module = await import('file://' + funcPath + cacheBust);
            const handler = module.default || module;
            
            // Execute the serverless handler
            await handler(req, res);
        } catch (e) {
            console.error(`[API ERROR] ${req.path}:`, e);
            res.status(500).json({ error: 'Internal Server Error', details: e.message });
        }
    } else {
        res.status(404).json({ error: 'Function not found' });
    }
});

// Fallback for SPA routing (React/Next.js client-side routing)
app.use((req, res) => {
    serveVersionedHTML(res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '127.0.0.1', () => {
    console.log(`[SOVEREIGN EDGE] Running autonomously on port ${PORT}`);
});
