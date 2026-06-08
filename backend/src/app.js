"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const node_path_1 = __importDefault(require("node:path"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./config");
const routes_1 = __importDefault(require("./routes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const billingRoutes_1 = __importDefault(require("./routes/billingRoutes"));
const createApp = () => {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)({
        origin: config_1.config.frontendUrl
    }));
    app.use('/api/billing/webhook', express_1.default.raw({ type: 'application/json' }));
    app.use(express_1.default.json({ limit: '10mb' }));
    const staticOptions = {
        acceptRanges: true,
        setHeaders: (res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', '*');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    };
    app.use('/storage/uploads', express_1.default.static(node_path_1.default.join(config_1.config.rootDir, 'storage/uploads'), staticOptions));
    app.use('/storage/work', express_1.default.static(config_1.config.workingDir, staticOptions));
    app.use('/storage', express_1.default.static(node_path_1.default.join(config_1.config.rootDir, 'storage/exports'), staticOptions));
    app.get('/', (_req, res) => {
        res.json({
            name: 'AI Marketing Studio MVP API',
            status: 'ok',
            health: `${config_1.config.appUrl}/api/health`,
            frontend: config_1.config.frontendUrl
        });
    });
    app.use('/api/auth', authRoutes_1.default);
    app.use('/api/billing', billingRoutes_1.default);
    app.use('/api', routes_1.default);
    app.use((error, _req, res, _next) => {
        const status = error.statusCode || 500;
        res.status(status).json({
            message: error.message || 'Unexpected server error.'
        });
    });
    return app;
};
exports.createApp = createApp;
