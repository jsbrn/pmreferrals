"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const fs_1 = __importDefault(require("fs"));
const app = (0, express_1.default)();
const IndexRoutes_1 = __importDefault(require("./routes/IndexRoutes"));
async function start() {
    console.log(__dirname);
    app.set("view engine", "hbs");
    app.set("views", path_1.default.join(__dirname, "views"));
    app.use("/assets", express_1.default.static(path_1.default.join(__dirname, "views/assets")));
    app.use("/images", express_1.default.static(path_1.default.join(__dirname, "views/assets/images")));
    app.use("/css", express_1.default.static(path_1.default.join(__dirname, "views/assets/stylesheets")));
    app.use("/scripts", express_1.default.static(path_1.default.join(__dirname, "views/assets/scripts")));
    app.use("/", IndexRoutes_1.default);
    const httpServer = http_1.default.createServer(app);
    httpServer.on("error", (e) => console.error(e));
    httpServer.listen(parseInt(process.env.WEBSITE_PORT), () => console.log("HTTP server started at port " + process.env.WEBSITE_PORT));
    if (process.env.ENVIRONMENT?.startsWith("prod")) {
        const privateKeyDir = path_1.default.resolve(__dirname, "..", process.env.WEBSITE_PRIVATE_KEY);
        const certDir = path_1.default.resolve(__dirname, "..", process.env.WEBSITE_CERTIFICATE);
        const privateKey = fs_1.default.readFileSync(privateKeyDir, 'utf8');
        const certificate = fs_1.default.readFileSync(certDir, 'utf8');
        const credentials = { key: privateKey, cert: certificate };
        const httpsServer = https_1.default.createServer(credentials, app);
        httpsServer.listen(parseInt(process.env.WEBSITE_HTTPS_PORT));
    }
}
async function connectToDatabase() {
    console.info("Connecting to database...");
    const uri = "mongodb://" + process.env.MONGO_INITDB_ROOT_USERNAME + ":" +
        process.env.MONGO_INITDB_ROOT_PASSWORD +
        "@" +
        process.env.MONGO_DOMAIN +
        "/" +
        process.env.MONGO_DATABASE + "?authSource=admin";
    await mongoose_1.default
        .connect(uri)
        .then(() => {
        console.info(`Connected to MongoDB!`);
    })
        .catch((err) => {
        console.error(`Failed to connect to database`, err);
        setTimeout(connectToDatabase, 5000);
    });
}
async function shutdown() {
    console.log("Shutting down gracefully...");
    try {
    }
    catch (error) {
        console.error("Error shutting down gracefully!", error);
    }
    finally {
        process.exit();
    }
}
start();
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
//# sourceMappingURL=index.js.map