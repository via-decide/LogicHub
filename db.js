// db.js - PostgreSQL Database Adapter
// Handles all database operations for LogicHub
// REQUIRES: npm install pg dotenv

import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;

dotenv.config();

// Create connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://logichub:password@localhost:5432/logichub',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

pool.on('connect', () => {
    console.log('✓ Database pool connection established');
});

// Database operations
export const db = {
    // Create a new user
    createUser: async (userData) => {
        const { email, username, hashedPassword, firstName = null, lastName = null } = userData;
        
        try {
            const result = await pool.query(
                `INSERT INTO Users (email, username, password_hash, first_name, last_name, created_at, updated_at) 
                 VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) 
                 RETURNING user_id, email, username, first_name, last_name, created_at`,
                [email, username, hashedPassword, firstName, lastName]
            );
            
            const user = result.rows[0];
            return {
                id: user.user_id,
                email: user.email,
                username: user.username,
                name: [user.first_name, user.last_name].filter(Boolean).join(' '),
                createdAt: user.created_at
            };
        } catch (error) {
            if (error.code === '23505') {  // Unique constraint violation
                const constraint = error.constraint;
                if (constraint === 'users_email_key') {
                    throw new Error('User with that email already exists');
                } else if (constraint === 'users_username_key') {
                    throw new Error('Username is already taken');
                }
            }
            throw new Error(`Failed to create user: ${error.message}`);
        }
    },

    // Find user by email
    findUserByEmail: async (email) => {
        try {
            const result = await pool.query(
                'SELECT user_id, email, username, password_hash, first_name, last_name, created_at FROM Users WHERE email = $1',
                [email]
            );
            
            if (result.rows.length === 0) {
                return null;
            }
            
            const user = result.rows[0];
            return {
                id: user.user_id,
                email: user.email,
                username: user.username,
                passwordHash: user.password_hash,
                name: [user.first_name, user.last_name].filter(Boolean).join(' '),
                createdAt: user.created_at
            };
        } catch (error) {
            throw new Error(`Database error: ${error.message}`);
        }
    },

    // Find user by username
    findUserByUsername: async (username) => {
        try {
            const result = await pool.query(
                'SELECT user_id, email, username, password_hash, first_name, last_name, created_at FROM Users WHERE username = $1',
                [username]
            );
            
            if (result.rows.length === 0) {
                return null;
            }
            
            const user = result.rows[0];
            return {
                id: user.user_id,
                email: user.email,
                username: user.username,
                passwordHash: user.password_hash,
                name: [user.first_name, user.last_name].filter(Boolean).join(' '),
                createdAt: user.created_at
            };
        } catch (error) {
            throw new Error(`Database error: ${error.message}`);
        }
    },

    // Find user by ID
    findUserById: async (userId) => {
        try {
            const result = await pool.query(
                'SELECT user_id, email, username, first_name, last_name, created_at FROM Users WHERE user_id = $1',
                [userId]
            );
            
            if (result.rows.length === 0) {
                return null;
            }
            
            const user = result.rows[0];
            return {
                id: user.user_id,
                email: user.email,
                username: user.username,
                name: [user.first_name, user.last_name].filter(Boolean).join(' '),
                createdAt: user.created_at
            };
        } catch (error) {
            throw new Error(`Database error: ${error.message}`);
        }
    },

    // Update user profile
    updateUser: async (userId, updates) => {
        const { firstName, lastName, email } = updates;
        
        try {
            const result = await pool.query(
                `UPDATE Users SET first_name = COALESCE($1, first_name), 
                                last_name = COALESCE($2, last_name),
                                email = COALESCE($3, email),
                                updated_at = NOW()
                 WHERE user_id = $4
                 RETURNING user_id, email, username, first_name, last_name, updated_at`,
                [firstName || null, lastName || null, email || null, userId]
            );
            
            if (result.rows.length === 0) {
                throw new Error('User not found');
            }
            
            const user = result.rows[0];
            return {
                id: user.user_id,
                email: user.email,
                username: user.username,
                name: [user.first_name, user.last_name].filter(Boolean).join(' '),
                updatedAt: user.updated_at
            };
        } catch (error) {
            throw new Error(`Failed to update user: ${error.message}`);
        }
    },

    // Get all products
    getProducts: async (limit = 50, offset = 0) => {
        try {
            const result = await pool.query(
                'SELECT product_id, name, description, price, stock_quantity, category_id, created_at FROM Products ORDER BY created_at DESC LIMIT $1 OFFSET $2',
                [limit, offset]
            );
            
            return result.rows.map(p => ({
                id: p.product_id,
                name: p.name,
                description: p.description,
                price: parseFloat(p.price),
                stockQuantity: p.stock_quantity,
                categoryId: p.category_id,
                createdAt: p.created_at
            }));
        } catch (error) {
            throw new Error(`Failed to fetch products: ${error.message}`);
        }
    },

    // Get product by ID
    getProductById: async (productId) => {
        try {
            const result = await pool.query(
                'SELECT product_id, name, description, price, stock_quantity, category_id FROM Products WHERE product_id = $1',
                [productId]
            );
            
            if (result.rows.length === 0) {
                return null;
            }
            
            const p = result.rows[0];
            return {
                id: p.product_id,
                name: p.name,
                description: p.description,
                price: parseFloat(p.price),
                stockQuantity: p.stock_quantity,
                categoryId: p.category_id
            };
        } catch (error) {
            throw new Error(`Failed to fetch product: ${error.message}`);
        }
    },

    // Create order
    createOrder: async (userId, items, shippingAddressId, billingAddressId) => {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Create order
            const orderResult = await client.query(
                `INSERT INTO Orders (user_id, order_date, total_amount, status, shipping_address_id, billing_address_id) 
                 VALUES ($1, NOW(), 0, 'pending', $2, $3) 
                 RETURNING order_id`,
                [userId, shippingAddressId, billingAddressId]
            );
            
            const orderId = orderResult.rows[0].order_id;
            let totalAmount = 0;
            
            // Add order items
            for (const item of items) {
                const productResult = await client.query(
                    'SELECT price, stock_quantity FROM Products WHERE product_id = $1',
                    [item.productId]
                );
                
                if (productResult.rows.length === 0) {
                    throw new Error(`Product ${item.productId} not found`);
                }
                
                const product = productResult.rows[0];
                const priceAtPurchase = parseFloat(product.price);
                const itemTotal = priceAtPurchase * item.quantity;
                totalAmount += itemTotal;
                
                // Check stock
                if (product.stock_quantity < item.quantity) {
                    throw new Error(`Insufficient stock for product ${item.productId}`);
                }
                
                // Add order item
                await client.query(
                    `INSERT INTO Order_Items (order_id, product_id, quantity, price_at_purchase) 
                     VALUES ($1, $2, $3, $4)`,
                    [orderId, item.productId, item.quantity, priceAtPurchase]
                );
                
                // Update product stock
                await client.query(
                    'UPDATE Products SET stock_quantity = stock_quantity - $1 WHERE product_id = $2',
                    [item.quantity, item.productId]
                );
            }
            
            // Update order total
            await client.query(
                'UPDATE Orders SET total_amount = $1 WHERE order_id = $2',
                [totalAmount, orderId]
            );
            
            await client.query('COMMIT');
            
            return {
                id: orderId,
                userId,
                totalAmount,
                status: 'pending',
                items: items.length
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw new Error(`Failed to create order: ${error.message}`);
        } finally {
            client.release();
        }
    },

    // Get user orders
    getUserOrders: async (userId, limit = 20, offset = 0) => {
        try {
            const result = await pool.query(
                `SELECT order_id, user_id, order_date, total_amount, status 
                 FROM Orders 
                 WHERE user_id = $1 
                 ORDER BY order_date DESC 
                 LIMIT $2 OFFSET $3`,
                [userId, limit, offset]
            );
            
            return result.rows.map(o => ({
                id: o.order_id,
                userId: o.user_id,
                orderDate: o.order_date,
                totalAmount: parseFloat(o.total_amount),
                status: o.status
            }));
        } catch (error) {
            throw new Error(`Failed to fetch orders: ${error.message}`);
        }
    },

    // Health check
    healthCheck: async () => {
        try {
            const result = await pool.query('SELECT NOW()');
            return {
                status: 'healthy',
                timestamp: result.rows[0].now
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    },

    // Close pool connection
    close: async () => {
        await pool.end();
        console.log('✓ Database pool closed');
    }
};

export default db;
