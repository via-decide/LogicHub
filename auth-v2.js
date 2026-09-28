// LogicHub Auth v2 - Real Cryptography
// Replaces auth.js with Web Crypto API (JWT) + bcryptjs (password hashing)
// REQUIRES: npm install bcryptjs

import bcryptjs from 'bcryptjs';

let _config = {};
let _providers = {};
let _jwtSecret = 'super-secret-default-jwt-key-change-this-in-production';
const SESSION_COOKIE_NAME = 'auth_session';

// Password validation
const validatePassword = (password) => {
    const errors = [];
    if (password.length < 8) errors.push('At least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('At least one digit');
    if (!/[!@#$%^&*()_+=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('At least one special character');
    
    if (errors.length > 0) {
        throw new Error(`Password does not meet requirements: ${errors.join(', ')}`);
    }
    return true;
};

// Real JWT using Web Crypto API (HMAC-SHA256)
const jwt = {
    _encode: async (payload, secret, options = {}) => {
        try {
            const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
            const encodedPayload = btoa(JSON.stringify(payload));
            
            // Create HMAC-SHA256 signature
            const encoder = new TextEncoder();
            const keyData = encoder.encode(secret);
            const key = await crypto.subtle.importKey(
                'raw',
                keyData,
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            );
            
            const messageData = encoder.encode(`${header}.${encodedPayload}`);
            const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);
            const signatureArray = Array.from(new Uint8Array(signatureBuffer));
            const signature = btoa(String.fromCharCode.apply(null, signatureArray));
            
            return `${header}.${encodedPayload}.${signature}`;
        } catch (error) {
            throw new Error(`JWT encoding failed: ${error.message}`);
        }
    },
    
    _decode: async (token, secret, options = {}) => {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                throw new Error('Invalid JWT format');
            }
            
            const payload = JSON.parse(atob(parts[1]));
            
            // Verify signature
            const encoder = new TextEncoder();
            const keyData = encoder.encode(secret);
            const key = await crypto.subtle.importKey(
                'raw',
                keyData,
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['verify']
            );
            
            const messageData = encoder.encode(`${parts[0]}.${parts[1]}`);
            const signatureData = Uint8Array.from(atob(parts[2]), c => c.charCodeAt(0));
            
            const isValid = await crypto.subtle.verify('HMAC', key, signatureData, messageData);
            
            if (!isValid) {
                throw new Error('JWT signature verification failed');
            }
            
            return payload;
        } catch (error) {
            console.error('JWT decode error:', error.message);
            return null;
        }
    }
};

// Real bcrypt hashing
const bcrypt = {
    _hash: async (password) => {
        try {
            const saltRounds = 10;  // OWASP recommended
            return await bcryptjs.hash(password, saltRounds);
        } catch (error) {
            throw new Error(`Password hashing failed: ${error.message}`);
        }
    },
    
    _compare: async (password, hashedPassword) => {
        try {
            return await bcryptjs.compare(password, hashedPassword);
        } catch (error) {
            console.error('Password comparison error:', error.message);
            return false;
        }
    }
};

// Cookie operations
const cookie = {
    _set: (res, name, value, options = {}) => {
        let serialized = `${name}=${encodeURIComponent(value)}; Path=${options.path || '/'}; HttpOnly; Secure; SameSite=Lax`;
        if (options.expires) serialized += `; Expires=${options.expires.toUTCString()}`;
        if (options.maxAge) serialized += `; Max-Age=${options.maxAge}`;
        if (res && typeof res.setHeader === 'function') {
            res.setHeader('Set-Cookie', serialized);
        }
        return serialized;
    },
    
    _clear: (res, name, options = {}) => {
        const expiredDate = new Date(0);
        return cookie._set(res, name, '', { ...options, expires: expiredDate, maxAge: 0 });
    },
    
    _get: (req, name) => {
        if (req && req.headers && req.headers.cookie) {
            const cookies = req.headers.cookie.split(';');
            for (const c of cookies) {
                const parts = c.trim().split('=');
                if (parts[0] === name) {
                    return decodeURIComponent(parts[1]);
                }
            }
        }
        return undefined;
    }
};

// Provider classes
class Provider {
    constructor(id, options) {
        this.id = id;
        this.options = options;
        this.type = 'base';
    }

    async authorize(...args) {
        throw new Error('Authorize method must be implemented by concrete providers.');
    }
}

class CredentialsProvider extends Provider {
    constructor(options) {
        super(options.id || 'credentials', options);
        this.type = 'credentials';
        this.credentials = options.credentials || {};
        this.authorize = options.authorize;
    }
}

class OAuthProvider extends Provider {
    constructor(options) {
        super(options.id, options);
        this.type = 'oauth';
        this.clientId = options.clientId;
        this.clientSecret = options.clientSecret;
        this.authorizationUrl = options.authorizationUrl;
        this.tokenUrl = options.tokenUrl;
        this.profileUrl = options.profileUrl;
        this.scope = options.scope;
        this.profile = options.profile || (profile => profile);
        this.accessTokenParams = options.accessTokenParams || {};
        this.requestToken = options.requestToken;
        this.getUserProfile = options.getUserProfile;
    }
}

// Default callbacks
const defaultCallbacks = {
    async session({ session, token }) {
        if (token) {
            session.user = session.user || {};
            session.user.id = token.sub;
            session.user.email = token.email;
            session.user.name = token.name;
        }
        return session;
    },
    
    async jwt({ token, user, account, profile, isNewUser }) {
        if (user) {
            token.sub = user.id;
            token.email = user.email;
            token.name = user.name;
        }
        if (account) {
            token.accessToken = account.access_token;
            token.refreshToken = account.refresh_token;
            token.expiresAt = account.expires_at;
            token.providerId = account.provider;
        }
        return token;
    },
    
    async signIn({ user, account, profile, email, credentials }) {
        return true;
    },
    
    async signUp({ user, credentials }) {
        return true;
    },
    
    async redirect({ url, baseUrl }) {
        if (url.startsWith(baseUrl)) return url;
        if (url.startsWith('/')) return new URL(url, baseUrl).toString();
        return baseUrl;
    }
};

// Main Auth object
const Auth = {
    init: (options) => {
        _config = {
            ...options,
            secret: options.secret || process.env.AUTH_SECRET || _jwtSecret,
            callbacks: { ...defaultCallbacks, ...options.callbacks },
            session: {
                maxAge: 30 * 24 * 60 * 60,
                updateAge: 24 * 60 * 60,
                ...options.session
            },
            jwt: {
                maxAge: 30 * 24 * 60 * 60,
                ...options.jwt
            },
            pages: {
                signIn: '/auth/signin',
                signOut: '/auth/signout',
                error: '/auth/error',
                verifyRequest: '/auth/verify-request',
                newUser: null,
                ...options.pages
            }
        };
        _jwtSecret = _config.secret;

        if (_config.providers) {
            _config.providers.forEach(p => {
                if (p instanceof CredentialsProvider || p instanceof OAuthProvider) {
                    _providers[p.id] = p;
                }
            });
        }
    },

    signIn: async (providerId, credentials, req, res) => {
        const provider = _providers[providerId];
        if (!provider) {
            throw new Error(`Provider '${providerId}' not found.`);
        }

        let user = null;
        let account = null;
        let profile = null;

        try {
            if (provider.type === 'credentials') {
                user = await provider.authorize(credentials);
            } else if (provider.type === 'oauth') {
                if (credentials.code && provider.requestToken && provider.getUserProfile) {
                    const tokenResponse = await provider.requestToken(credentials.code, credentials.redirect_uri);
                    account = { ...tokenResponse, provider: provider.id, type: 'oauth' };
                    profile = await provider.getUserProfile(account.access_token);
                    user = provider.profile(profile);
                } else {
                    throw new Error('OAuth callback requires code and specific provider methods.');
                }
            } else {
                throw new Error(`Unsupported provider type: ${provider.type}`);
            }

            if (!user) {
                return null;
            }

            const signInAllowed = await _config.callbacks.signIn({ user, account, profile, credentials });
            if (!signInAllowed) {
                return null;
            }

            let token = {};
            token = await _config.callbacks.jwt({ token, user, account, profile, isNewUser: false });

            // Use async JWT encoding
            const encodedToken = await jwt._encode(token, _jwtSecret, { expiresIn: _config.jwt.maxAge });

            if (res) {
                cookie._set(res, SESSION_COOKIE_NAME, encodedToken, {
                    maxAge: _config.session.maxAge,
                    path: '/',
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'Lax'
                });
            }

            return user;
        } catch (error) {
            throw error;
        }
    },

    signUp: async (credentials, createUserFn, req, res) => {
        if (!createUserFn || typeof createUserFn !== 'function') {
            throw new Error('createUserFn must be provided for sign-up.');
        }

        const { password, ...userData } = credentials;
        if (!password) {
            throw new Error('Password is required for sign-up.');
        }

        try {
            // Validate password strength
            validatePassword(password);

            const hashedPassword = await bcrypt._hash(password);
            const newUser = await createUserFn({ ...userData, hashedPassword });

            if (!newUser) {
                return null;
            }

            const signUpAllowed = await _config.callbacks.signUp({ user: newUser, credentials });
            if (!signUpAllowed) {
                return null;
            }

            return newUser;
        } catch (error) {
            throw error;
        }
    },

    signOut: (res) => {
        if (res) {
            cookie._clear(res, SESSION_COOKIE_NAME, {
                path: '/',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Lax'
            });
        }
    },

    getSession: async (req) => {
        if (!req) {
            return null;
        }

        const sessionToken = cookie._get(req, SESSION_COOKIE_NAME);
        if (!sessionToken) {
            return null;
        }

        try {
            const decodedToken = await jwt._decode(sessionToken, _jwtSecret);
            if (!decodedToken) {
                return null;
            }

            let session = {
                user: {
                    id: decodedToken.sub,
                    email: decodedToken.email,
                    name: decodedToken.name,
                },
                expires: new Date(Date.now() + _config.session.maxAge * 1000).toISOString(),
            };

            session = await _config.callbacks.session({ session, token: decodedToken });

            return session;
        } catch (error) {
            console.error('Session retrieval error:', error.message);
            return null;
        }
    },

    handleAuthRequest: async (req, res) => {
        if (!_config.secret) {
            res.statusCode = 500;
            res.json({ error: 'Auth not initialized. Call Auth.init(options) first.' });
            return;
        }

        const authPath = req.url.split('?')[0].split('/').filter(Boolean);
        const apiSegmentIndex = authPath.indexOf('api');
        if (apiSegmentIndex === -1 || authPath.length <= apiSegmentIndex + 2) {
            res.statusCode = 404;
            res.end('Not Found');
            return;
        }

        const action = authPath[apiSegmentIndex + 2];
        const providerId = authPath[apiSegmentIndex + 3];

        const baseUrl = new URL(req.url, `http://${req.headers.host}`).origin;

        try {
            if (action === 'signin') {
                if (req.method === 'POST' && providerId === 'credentials') {
                    const user = await Auth.signIn(providerId, req.body, req, res);
                    if (user) {
                        res.statusCode = 200;
                        res.json({ message: 'Sign-in successful', user: { id: user.id, name: user.name, email: user.email } });
                    } else {
                        res.statusCode = 401;
                        res.json({ error: 'Invalid credentials' });
                    }
                } else if (providerId in _providers && _providers[providerId].type === 'oauth') {
                    const provider = _providers[providerId];
                    const authorizeUrl = `${provider.authorizationUrl}?response_type=code&client_id=${provider.clientId}&scope=${encodeURIComponent(provider.scope || '')}&redirect_uri=${encodeURIComponent(`${baseUrl}/api/auth/callback/${providerId}`)}`;
                    res.statusCode = 302;
                    res.setHeader('Location', authorizeUrl);
                    res.end();
                } else {
                    res.statusCode = 405;
                    res.end('Method Not Allowed or Provider Not Supported for Signin');
                }
            } else if (action === 'callback' && providerId in _providers && _providers[providerId].type === 'oauth') {
                const user = await Auth.signIn(providerId, { ...req.query, redirect_uri: `${baseUrl}/api/auth/callback/${providerId}` }, req, res);
                const redirectUrl = await _config.callbacks.redirect({ url: user ? '/' : _config.pages.error, baseUrl });
                res.statusCode = 302;
                res.setHeader('Location', redirectUrl);
                res.end();
            } else if (action === 'signout') {
                Auth.signOut(res);
                const redirectUrl = await _config.callbacks.redirect({ url: _config.pages.signOut, baseUrl });
                res.statusCode = 302;
                res.setHeader('Location', redirectUrl);
                res.end();
            } else if (action === 'session') {
                const session = await Auth.getSession(req);
                res.statusCode = 200;
                res.json(session || { user: null });
            } else {
                res.statusCode = 404;
                res.end('Not Found');
            }
        } catch (error) {
            res.statusCode = 500;
            res.json({ error: 'Internal Server Error', details: error.message });
        }
    }
};

const AuthFactory = {
    init: Auth.init,
    signIn: Auth.signIn,
    signUp: Auth.signUp,
    signOut: Auth.signOut,
    getSession: Auth.getSession,
    handleAuthRequest: Auth.handleAuthRequest,
    validatePassword,
    Provider: Provider,
    CredentialsProvider: CredentialsProvider,
    OAuthProvider: OAuthProvider
};

// Export for browser/Node environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthFactory;
}

export default AuthFactory;
