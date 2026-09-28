// server.js - LogicHub Express Server
// Full integration: Auth + Database + API Routes
// REQUIRES: npm install express dotenv cors body-parser bcryptjs pg

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import bodyParser from 'body-parser';
import AuthFactory from './auth-v2.js';
import db from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3000;

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static files (CSS, JS, images)
app.use(express.static('public'));

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const dbHealth = await db.healthCheck();
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: dbHealth
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Initialize Auth
const credentialsProvider = new AuthFactory.CredentialsProvider({
    id: 'credentials',
    authorize: async (credentials) => {
        // Verify email and password against database
        const user = await db.findUserByEmail(credentials.email);
        if (!user) {
            throw new Error('User not found');
        }

        // Import bcryptjs for comparison
        const bcryptjs = await import('bcryptjs');
        const isValid = await bcryptjs.default.compare(credentials.password, user.passwordHash);
        if (!isValid) {
            throw new Error('Invalid password');
        }

        return {
            id: user.id,
            email: user.email,
            name: user.name
        };
    }
});

AuthFactory.init({
    secret: process.env.AUTH_SECRET,
    providers: [credentialsProvider],
    pages: {
        signIn: '/auth/signin',
        signOut: '/auth/signout',
        error: '/auth/error'
    }
});

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { email, username, password, firstName, lastName } = req.body;

        // Validate required fields
        if (!email || !username || !password) {
            return res.status(400).json({
                error: 'Email, username, and password are required'
            });
        }

        // Sign up with database persistence
        const newUser = await AuthFactory.signUp(
            { email, username, password, firstName, lastName },
            async (userData) => {
                return await db.createUser(userData);
            },
            req,
            res
        );

        if (!newUser) {
            return res.status(400).json({
                error: 'Sign-up failed'
            });
        }

        res.json({
            message: 'Sign-up successful',
            user: {
                id: newUser.id,
                email: newUser.email,
                username: newUser.username,
                name: newUser.name
            }
        });
    } catch (error) {
        console.error('Sign-up error:', error);
        res.status(400).json({
            error: error.message || 'Sign-up failed'
        });
    }
});

app.post('/api/auth/signin', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }

        const user = await AuthFactory.signIn(
            'credentials',
            { email, password },
            req,
            res
        );

        if (!user) {
            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }

        res.json({
            message: 'Sign-in successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });
    } catch (error) {
        console.error('Sign-in error:', error);
        res.status(400).json({
            error: error.message || 'Sign-in failed'
        });
    }
});

app.post('/api/auth/signout', (req, res) => {
    try {
        AuthFactory.signOut(res);
        res.json({ message: 'Signed out successfully' });
    } catch (error) {
        res.status(500).json({
            error: error.message || 'Sign-out failed'
        });
    }
});

app.get('/api/auth/session', async (req, res) => {
    try {
        const session = await AuthFactory.getSession(req);
        res.json(session || { user: null });
    } catch (error) {
        res.status(500).json({
            error: error.message || 'Session retrieval failed'
        });
    }
});

// User Routes
app.get('/api/users/:id', async (req, res) => {
    try {
        const user = await db.findUserById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/users/:id', async (req, res) => {
    try {
        const { firstName, lastName, email } = req.body;
        const updated = await db.updateUser(req.params.id, { firstName, lastName, email });
        res.json(updated);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Product Routes
app.get('/api/products', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = parseInt(req.query.offset) || 0;
        const products = await db.getProducts(limit, offset);
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await db.getProductById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Order Routes
app.post('/api/orders', async (req, res) => {
    try {
        const { userId, items, shippingAddressId, billingAddressId } = req.body;

        if (!userId || !items || items.length === 0) {
            return res.status(400).json({
                error: 'userId and items are required'
            });
        }

        const order = await db.createOrder(userId, items, shippingAddressId, billingAddressId);
        res.status(201).json(order);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/orders/:userId', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = parseInt(req.query.offset) || 0;
        const orders = await db.getUserOrders(req.params.userId, limit, offset);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║          LogicHub Server Started                   ║
║────────────────────────────────────────────────────║
║  Port:     ${PORT}                                    
║  Env:      ${process.env.NODE_ENV || 'development'}                                 
║  URL:      http://localhost:${PORT}               
║════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('\n✓ SIGTERM received, shutting down gracefully...');
    server.close(async () => {
        await db.close();
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('\n✓ SIGINT received, shutting down gracefully...');
    server.close(async () => {
        await db.close();
        process.exit(0);
    });
});

export default app;
