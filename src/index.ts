import mongoose from "mongoose";
import express from "express";
import path from "path";
import http from "http";
import https from "https";
import fs from "fs";
import hbs from "hbs";
const app = express();

import indexRouter from "./routes/IndexRoutes";

async function start() {

    console.log(__dirname);

    // SETUP TEMPLATING
    app.set("view engine", "hbs");
    app.set("views", path.join(__dirname, "views"));
    app.use("/assets", express.static(path.join(__dirname, "views/assets")));
    app.use("/images", express.static(path.join(__dirname, "views/assets/images")));
    app.use("/css", express.static(path.join(__dirname, "views/assets/stylesheets")));
    app.use("/scripts", express.static(path.join(__dirname, "views/assets/scripts")));

    // ESTABLISH ROUTES
    app.use("/", indexRouter);

    // HTTP SERVER
    const httpServer = http.createServer(app);
    httpServer.on("error", (e) => console.error(e));
    httpServer.listen(parseInt(process.env.WEBSITE_PORT!), () => console.log("HTTP server started at port "+process.env.WEBSITE_PORT));

    // HTTPS SERVER
    if (process.env.ENVIRONMENT?.startsWith("prod")) {
        const privateKeyDir = path.resolve(__dirname, "..", process.env.WEBSITE_PRIVATE_KEY!);
        const certDir = path.resolve(__dirname, "..", process.env.WEBSITE_CERTIFICATE!);

        const privateKey = fs.readFileSync(privateKeyDir, 'utf8');
        const certificate = fs.readFileSync(certDir, 'utf8');
        const credentials = {key: privateKey, cert: certificate};

        const httpsServer = https.createServer(credentials, app);
        httpsServer.listen(parseInt(process.env.WEBSITE_HTTPS_PORT!));
    }

}

async function connectToDatabase() {
    console.info("Connecting to database...");
    const uri =
        "mongodb://"+process.env.MONGO_INITDB_ROOT_USERNAME+":" +
        process.env.MONGO_INITDB_ROOT_PASSWORD +
        "@" +
        process.env.MONGO_DOMAIN +
        "/" +
        process.env.MONGO_DATABASE+"?authSource=admin";
    await mongoose
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
        //await db.disconnect();
    } catch (error) {
        console.error("Error shutting down gracefully!", error);
    } finally {
        process.exit();
    }
}

start();
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);